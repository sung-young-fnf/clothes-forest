import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService, type AnonymousJwtPayload } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ClaudeService, type RecentMessage } from '../claude/claude.service';
import { RedisStore, type PresenceEntry } from './redis-stores';

const ROOM_ID = 'main';
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const IDLE_CHECK_INTERVAL_MS = 60 * 1000;

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
  },
})
export class RoomGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RoomGateway.name);
  private readonly instanceId =
    process.env.INSTANCE_ID ?? process.env.HOSTNAME ?? `inst-${process.pid}`;
  private idleTimer?: NodeJS.Timeout;

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly claude: ClaudeService,
    private readonly store: RedisStore,
  ) {}

  // ─── 연결 lifecycle ─────────────────────────────────

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`[${this.instanceId}] reject (no token)`);
      client.disconnect(true);
      return;
    }
    let payload: AnonymousJwtPayload;
    try {
      payload = this.auth.verifyToken(token);
    } catch {
      this.logger.warn(`[${this.instanceId}] reject (bad token)`);
      client.disconnect(true);
      return;
    }

    // 같은 인스턴스 내 중복 deviceId 소켓 정리 (다른 인스턴스는 Redis adapter가 broadcast 동기화로 자연 정리)
    for (const [sid, s] of this.server.sockets.sockets) {
      if (sid !== client.id && s.data?.user?.sub === payload.sub) {
        s.disconnect(true);
      }
    }

    client.data.user = payload;
    client.join(ROOM_ID);
    this.logger.log(`[${this.instanceId}] connect ${client.id} (${payload.nickname})`);
  }

  async handleDisconnect(client: Socket) {
    const user = client.data.user as AnonymousJwtPayload | undefined;
    if (!user) return;
    const entry = await this.store.getPresence(user.sub);
    if (entry) {
      await this.store.deletePresence(user.sub);
      this.server.to(ROOM_ID).emit('user:left', { deviceId: user.sub });
      this.logger.log(`[${this.instanceId}] disconnect ${client.id} (${user.nickname})`);
    }
  }

  // ─── 이벤트 핸들러 ─────────────────────────────────

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { col: number; row: number },
  ): Promise<{ peers: PresenceEntry[] }> {
    const user = client.data.user as AnonymousJwtPayload;
    const entry: PresenceEntry = {
      deviceId: user.sub,
      nickname: user.nickname,
      characterId: user.characterId,
      col: Number.isFinite(data?.col) ? data.col : 12,
      row: Number.isFinite(data?.row) ? data.row : 10,
      lastActiveAt: Date.now(),
    };
    await this.store.setPresence(entry);
    client.to(ROOM_ID).emit('user:joined', entry);
    const all = await this.store.allPresence();
    const peers = all.filter((p) => p.deviceId !== user.sub);
    return { peers };
  }

  @SubscribeMessage('move')
  async handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { col: number; row: number },
  ): Promise<void> {
    const user = client.data.user as AnonymousJwtPayload;
    if (!Number.isFinite(data?.col) || !Number.isFinite(data?.row)) return;
    const updated = await this.store.touchPresence(user.sub, { col: data.col, row: data.row });
    if (!updated) return;
    client.to(ROOM_ID).emit('user:moved', {
      deviceId: user.sub,
      col: updated.col,
      row: updated.row,
    });
  }

  @SubscribeMessage('chat:send')
  async handleChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { content: string },
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const user = client.data.user as AnonymousJwtPayload;
    const content = typeof data?.content === 'string' ? data.content.trim() : '';
    if (content.length === 0 || content.length > 500) {
      return { ok: false, reason: 'invalid_length' };
    }
    if (!(await this.store.allowChat(user.sub))) {
      return { ok: false, reason: 'rate_limited' };
    }

    await this.store.touchPresence(user.sub, {});

    const saved = await this.prisma.writer.chatMessage.create({
      data: {
        roomId: ROOM_ID,
        senderType: 'user',
        senderSessionId: user.sub,
        senderNickname: user.nickname,
        content,
        kind: 'text',
      },
    });

    this.server.to(ROOM_ID).emit('chat:new', {
      id: saved.id,
      deviceId: user.sub,
      nickname: user.nickname,
      characterId: user.characterId,
      senderType: 'user' as const,
      content: saved.content,
      kind: saved.kind,
      createdAt: saved.createdAt.toISOString(),
    });

    const question = this.extractClaudeQuestion(content);
    if (question !== null) {
      void this.replyAsClaude(user.nickname, question);
    }
    return { ok: true };
  }

  // ─── Claude / system 메시지 ─────────────────────────

  private extractClaudeQuestion(content: string): string | null {
    const m = content.match(/@claude\b/i);
    if (!m) return null;
    return content.replace(/@claude\b/i, '').trim() || '안녕';
  }

  private async replyAsClaude(askerNickname: string, question: string): Promise<void> {
    if (!this.claude.isAvailable()) {
      await this.emitSystem('@claude 응답이 아직 설정되지 않았어요 (AWS_BEARER_TOKEN_BEDROCK 미설정)');
      return;
    }
    try {
      const recent = await this.fetchRecentForContext();
      const text = await this.claude.replyToMention(askerNickname, question, recent);
      const saved = await this.prisma.writer.chatMessage.create({
        data: {
          roomId: ROOM_ID,
          senderType: 'claude',
          senderSessionId: null,
          senderNickname: 'Claude',
          content: text,
          kind: 'text',
        },
      });
      this.server.to(ROOM_ID).emit('chat:new', {
        id: saved.id,
        deviceId: null,
        nickname: 'Claude',
        characterId: 'claude',
        senderType: 'claude',
        content: saved.content,
        kind: saved.kind,
        createdAt: saved.createdAt.toISOString(),
      });
    } catch (err) {
      this.logger.error('Claude reply failed', err);
      await this.emitSystem('Claude 응답을 가져오지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  }

  private async fetchRecentForContext(): Promise<RecentMessage[]> {
    const rows = await this.prisma.reader.chatMessage.findMany({
      where: { roomId: ROOM_ID },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.reverse().map((m) => ({
      nickname: m.senderNickname,
      senderType: m.senderType as RecentMessage['senderType'],
      content: m.content,
    }));
  }

  private async emitSystem(text: string): Promise<void> {
    const saved = await this.prisma.writer.chatMessage.create({
      data: {
        roomId: ROOM_ID,
        senderType: 'system',
        senderSessionId: null,
        senderNickname: null,
        content: text,
        kind: 'system',
      },
    });
    this.server.to(ROOM_ID).emit('chat:new', {
      id: saved.id,
      deviceId: null,
      nickname: null,
      characterId: null,
      senderType: 'system',
      content: saved.content,
      kind: saved.kind,
      createdAt: saved.createdAt.toISOString(),
    });
  }

  // ─── Browse Session broadcast ─────────────────────────

  notifyBrowseStarted(data: { browseSessionId: string; hostDeviceId: string; hostNickname: string }) {
    void this.emitSystem(`${data.hostNickname}님이 쇼핑을 시작했어요`);
    this.server.to(ROOM_ID).emit('browse:start', data);
  }

  async notifyBrowsePage(data: {
    browseSessionId: string;
    hostNickname: string;
    page: {
      url: string;
      title: string | null;
      ogImageUrl: string | null;
      siteName: string | null;
      priceText: string | null;
    };
  }): Promise<void> {
    this.server.to(ROOM_ID).emit('browse:page', data);
    const content = data.page.title ?? data.page.url;
    const saved = await this.prisma.writer.chatMessage.create({
      data: {
        roomId: ROOM_ID,
        senderType: 'system',
        senderSessionId: null,
        senderNickname: data.hostNickname,
        content,
        kind: 'page_card',
        metadata: JSON.stringify({
          browseSessionId: data.browseSessionId,
          url: data.page.url,
          ogImageUrl: data.page.ogImageUrl,
          siteName: data.page.siteName,
          priceText: data.page.priceText,
        }),
      },
    });
    this.server.to(ROOM_ID).emit('chat:new', {
      id: saved.id,
      deviceId: null,
      nickname: data.hostNickname,
      characterId: null,
      senderType: 'system',
      content,
      kind: 'page_card',
      metadata: saved.metadata,
      createdAt: saved.createdAt.toISOString(),
    });
  }

  notifyBrowseEnded(data: { browseSessionId: string; hostNickname: string }) {
    void this.emitSystem(`${data.hostNickname}님이 쇼핑을 종료했어요`);
    this.server.to(ROOM_ID).emit('browse:end', data);
  }

  // ─── 자리비움 자동 퇴장 (각 인스턴스가 자기 소켓만 검사) ────

  onModuleInit() {
    this.idleTimer = setInterval(() => void this.checkIdle(), IDLE_CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.idleTimer) clearInterval(this.idleTimer);
  }

  private async checkIdle(): Promise<void> {
    const now = Date.now();
    // 이 인스턴스에 붙어있는 소켓만 순회
    for (const [, socket] of this.server.sockets.sockets) {
      const user = socket.data?.user as AnonymousJwtPayload | undefined;
      if (!user) continue;
      const entry = await this.store.getPresence(user.sub);
      if (!entry) continue;
      if (now - entry.lastActiveAt > IDLE_TIMEOUT_MS) {
        this.logger.log(`[${this.instanceId}] idle kick ${socket.id} (${user.nickname})`);
        socket.disconnect(true);
      }
    }
  }

  private extractToken(client: Socket): string | undefined {
    const fromAuth = (client.handshake.auth as { token?: string } | undefined)?.token;
    if (fromAuth) return fromAuth;
    const fromQuery = client.handshake.query?.token;
    if (typeof fromQuery === 'string') return fromQuery;
    return undefined;
  }
}

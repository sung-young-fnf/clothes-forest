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

interface PresenceEntry {
  deviceId: string;
  nickname: string;
  characterId: string;
  col: number;
  row: number;
  lastActiveAt: number;
}

const ROOM_ID = 'main';
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5분 무활동 → 자동 퇴장
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // 1분마다 점검

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
  private readonly presence = new Map<string, PresenceEntry>(); // key: deviceId
  private readonly chatRate = new Map<string, { lastAt: number; windowStart: number; windowCount: number }>();
  private idleTimer?: NodeJS.Timeout;

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly claude: ClaudeService,
  ) {}

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`reject (no token): ${client.id}`);
      client.disconnect(true);
      return;
    }
    let payload: AnonymousJwtPayload;
    try {
      payload = this.auth.verifyToken(token);
    } catch {
      this.logger.warn(`reject (bad token): ${client.id}`);
      client.disconnect(true);
      return;
    }

    // 중복 접속 정리: 같은 deviceId 기존 소켓 끊기
    for (const [sid, s] of this.server.sockets.sockets) {
      if (sid !== client.id && s.data?.user?.sub === payload.sub) {
        s.disconnect(true);
      }
    }

    client.data.user = payload;
    client.join(ROOM_ID);
    this.logger.log(`connect ${client.id} (${payload.nickname})`);
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user as AnonymousJwtPayload | undefined;
    if (!user) return;
    const entry = this.presence.get(user.sub);
    this.presence.delete(user.sub);
    if (entry) {
      client.to(ROOM_ID).emit('user:left', { deviceId: user.sub });
      this.logger.log(`disconnect ${client.id} (${user.nickname})`);
    }
  }

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { col: number; row: number },
  ): { peers: PresenceEntry[] } {
    const user = client.data.user as AnonymousJwtPayload;
    const entry: PresenceEntry = {
      deviceId: user.sub,
      nickname: user.nickname,
      characterId: user.characterId,
      col: Number.isFinite(data?.col) ? data.col : 12,
      row: Number.isFinite(data?.row) ? data.row : 10,
      lastActiveAt: Date.now(),
    };
    this.presence.set(user.sub, entry);
    client.to(ROOM_ID).emit('user:joined', entry);
    const peers = [...this.presence.values()].filter((p) => p.deviceId !== user.sub);
    return { peers };
  }

  @SubscribeMessage('move')
  handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { col: number; row: number },
  ): void {
    const user = client.data.user as AnonymousJwtPayload;
    const entry = this.presence.get(user.sub);
    if (!entry) return;
    if (!Number.isFinite(data?.col) || !Number.isFinite(data?.row)) return;
    entry.col = data.col;
    entry.row = data.row;
    entry.lastActiveAt = Date.now();
    client.to(ROOM_ID).emit('user:moved', {
      deviceId: user.sub,
      col: entry.col,
      row: entry.row,
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
    if (!this.allowChat(user.sub)) {
      return { ok: false, reason: 'rate_limited' };
    }

    const presenceEntry = this.presence.get(user.sub);
    if (presenceEntry) presenceEntry.lastActiveAt = Date.now();

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

    const event = {
      id: saved.id,
      deviceId: user.sub,
      nickname: user.nickname,
      characterId: user.characterId,
      senderType: 'user' as const,
      content: saved.content,
      kind: saved.kind,
      createdAt: saved.createdAt.toISOString(),
    };
    this.server.to(ROOM_ID).emit('chat:new', event);

    // @claude 멘션이 있으면 비동기로 Claude 응답 생성
    const question = this.extractClaudeQuestion(content);
    if (question !== null) {
      void this.replyAsClaude(user.nickname, question);
    }
    return { ok: true };
  }

  /** content에서 @claude 부분을 떼고 본문만 반환. 멘션 없으면 null. */
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

  /** Rate limit: 초당 1 + 분당 30. */
  private allowChat(deviceId: string): boolean {
    const now = Date.now();
    const rec = this.chatRate.get(deviceId);
    if (!rec) {
      this.chatRate.set(deviceId, { lastAt: now, windowStart: now, windowCount: 1 });
      return true;
    }
    if (now - rec.lastAt < 1000) return false;
    if (now - rec.windowStart >= 60_000) {
      rec.windowStart = now;
      rec.windowCount = 0;
    }
    if (rec.windowCount >= 30) return false;
    rec.lastAt = now;
    rec.windowCount += 1;
    return true;
  }

  // ─── Browse Session broadcast (BrowseController에서 호출) ────

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
    // 1) 라이브 이벤트 (Extension의 push로 인한 page change)
    this.server.to(ROOM_ID).emit('browse:page', data);

    // 2) 채팅 패널에도 page_card 메시지로 영구 보존
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

  // ─── 자리비움 자동 퇴장 ─────────────────────────────

  onModuleInit() {
    this.idleTimer = setInterval(() => this.checkIdle(), IDLE_CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.idleTimer) clearInterval(this.idleTimer);
  }

  private checkIdle() {
    const now = Date.now();
    const expired: string[] = [];
    for (const [deviceId, entry] of this.presence) {
      if (now - entry.lastActiveAt > IDLE_TIMEOUT_MS) expired.push(deviceId);
    }
    if (expired.length === 0) return;
    for (const deviceId of expired) {
      for (const [, socket] of this.server.sockets.sockets) {
        if (socket.data?.user?.sub === deviceId) {
          this.logger.log(`idle kick ${socket.id} (${socket.data.user.nickname})`);
          socket.disconnect(true);
        }
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

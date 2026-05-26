import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const ROOM_ID = 'main';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async recent(limit = DEFAULT_LIMIT) {
    const take = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);
    const rows = await this.prisma.reader.chatMessage.findMany({
      where: { roomId: ROOM_ID },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.reverse().map((m) => ({
      id: m.id,
      deviceId: m.senderSessionId,
      nickname: m.senderNickname,
      senderType: m.senderType,
      content: m.content,
      kind: m.kind,
      createdAt: m.createdAt.toISOString(),
    }));
  }
}

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { CreateSessionDto } from './dto';
import { isBlockedNickname } from './nickname.guard';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async create(dto: CreateSessionDto) {
    if (isBlockedNickname(dto.nickname)) {
      throw new BadRequestException('부적절한 닉네임이에요. 다른 이름을 골라주세요.');
    }
    const deviceId = randomUUID();
    const session = await this.prisma.writer.session.create({
      data: {
        deviceId,
        nickname: dto.nickname,
        characterId: dto.characterId,
      },
    });
    const token = this.auth.issueAnonymousToken({
      sub: session.deviceId,
      nickname: session.nickname,
      characterId: session.characterId,
    });
    this.logger.log(`session created: ${session.deviceId} (${session.nickname}/${session.characterId})`);
    return { session, token };
  }

  async findById(deviceId: string) {
    const session = await this.prisma.reader.session.findUnique({
      where: { deviceId },
    });
    if (!session) {
      throw new NotFoundException(`Session ${deviceId} not found`);
    }
    return session;
  }
}

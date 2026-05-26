import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PageEventDto } from './dto';

@Injectable()
export class BrowseService {
  private readonly logger = new Logger(BrowseService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 현재 진행 중인 (ended_at IS NULL) 세션을 1개로 강제. 새로 시작 시 기존을 자동 종료. */
  async startSession(hostSessionId: string, hostNickname: string) {
    await this.prisma.writer.browseSession.updateMany({
      where: { endedAt: null },
      data: { endedAt: new Date() },
    });
    return this.prisma.writer.browseSession.create({
      data: { hostSessionId, hostNickname },
    });
  }

  async appendPageEvent(browseSessionId: string, hostSessionId: string, dto: PageEventDto) {
    const session = await this.prisma.reader.browseSession.findUnique({
      where: { id: browseSessionId },
    });
    if (!session) throw new NotFoundException('Browse session not found');
    if (session.endedAt) throw new BadRequestException('Browse session already ended');
    if (session.hostSessionId !== hostSessionId) {
      throw new BadRequestException('Only host can push page events');
    }

    // 비밀번호/결제 페이지 자동 차단 (서버 측 가드)
    if (/\b(login|signin|sign-in|pay|payment|checkout|order|cart|password)\b/i.test(dto.url)) {
      this.logger.warn(`blocked sensitive url: ${dto.url}`);
      throw new BadRequestException('Sensitive page blocked');
    }

    const event = await this.prisma.writer.pageEvent.create({
      data: {
        browseSessionId,
        url: dto.url,
        title: dto.title ?? null,
        ogImageUrl: dto.ogImageUrl ?? null,
        ogDescription: dto.ogDescription ?? null,
        siteName: dto.siteName ?? null,
        priceText: dto.priceText ?? null,
      },
    });

    await this.prisma.writer.browseSession.update({
      where: { id: browseSessionId },
      data: {
        lastUrl: dto.url,
        lastPageMeta: JSON.stringify({
          title: dto.title,
          ogImageUrl: dto.ogImageUrl,
          siteName: dto.siteName,
          priceText: dto.priceText,
        }),
      },
    });

    return event;
  }

  async endSession(browseSessionId: string, hostSessionId: string) {
    const session = await this.prisma.reader.browseSession.findUnique({
      where: { id: browseSessionId },
    });
    if (!session) throw new NotFoundException('Browse session not found');
    if (session.hostSessionId !== hostSessionId) {
      throw new BadRequestException('Only host can end the session');
    }
    if (session.endedAt) return session;
    return this.prisma.writer.browseSession.update({
      where: { id: browseSessionId },
      data: { endedAt: new Date() },
    });
  }
}

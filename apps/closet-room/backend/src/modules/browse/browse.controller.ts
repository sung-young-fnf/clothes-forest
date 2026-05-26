import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, type AnonymousJwtPayload } from '../../auth/auth.service';
import { BrowseService } from './browse.service';
import { ExchangePairNonceDto, PageEventDto } from './dto';
import { Public } from '../../auth/decorators/public.decorator';
import { RoomGateway } from '../room/room.gateway';

@ApiTags('Browse')
@Controller()
export class BrowseController {
  constructor(
    private readonly browse: BrowseService,
    private readonly auth: AuthService,
    private readonly room: RoomGateway,
  ) {}

  // ─── 페어링 ─────────────────────────────────────────

  @Public()
  @Post('pairings/exchange')
  @ApiOperation({ summary: 'nonce → Extension용 30일 토큰 + 활성 browseSessionId' })
  exchange(@Body() dto: ExchangePairNonceDto) {
    const { token, payload, browseSessionId } = this.auth.exchangePairNonce(dto.nonce);
    return {
      token,
      browseSessionId,
      session: { deviceId: payload.sub, nickname: payload.nickname, characterId: payload.characterId },
    };
  }

  // ─── Browse Session ─────────────────────────────────

  @ApiBearerAuth()
  @Post('browse-sessions')
  @ApiOperation({ summary: '쇼핑 동행 세션 시작 + 페어링 nonce 동시 발급' })
  async start(@Req() req: { user: AnonymousJwtPayload }) {
    const session = await this.browse.startSession(req.user.sub, req.user.nickname);
    this.room.notifyBrowseStarted({
      browseSessionId: session.id,
      hostDeviceId: req.user.sub,
      hostNickname: req.user.nickname,
    });
    const nonce = this.auth.issuePairNonce(
      { sub: req.user.sub, nickname: req.user.nickname, characterId: req.user.characterId },
      session.id,
    );
    return { ...session, nonce };
  }

  @ApiBearerAuth()
  @Post('browse-sessions/:id/page')
  @ApiOperation({ summary: '페이지 변경 push (Extension → 방 broadcast)' })
  async pushPage(
    @Param('id') id: string,
    @Body() dto: PageEventDto,
    @Req() req: { user: AnonymousJwtPayload },
  ) {
    const event = await this.browse.appendPageEvent(id, req.user.sub, dto);
    await this.room.notifyBrowsePage({
      browseSessionId: id,
      hostNickname: req.user.nickname,
      page: {
        url: event.url,
        title: event.title,
        ogImageUrl: event.ogImageUrl,
        siteName: event.siteName,
        priceText: event.priceText,
      },
    });
    return event;
  }

  @ApiBearerAuth()
  @Post('browse-sessions/:id/end')
  @ApiOperation({ summary: '쇼핑 동행 세션 종료' })
  async end(@Param('id') id: string, @Req() req: { user: AnonymousJwtPayload }) {
    const session = await this.browse.endSession(id, req.user.sub);
    this.room.notifyBrowseEnded({ browseSessionId: id, hostNickname: req.user.nickname });
    return session;
  }
}

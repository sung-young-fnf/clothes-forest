import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { AuthService, type AnonymousJwtPayload } from '../../auth/auth.service';
import { CreateSessionDto } from './dto';
import { SessionService } from './session.service';

@ApiTags('Session')
@Controller('sessions')
export class SessionController {
  constructor(
    private readonly service: SessionService,
    private readonly auth: AuthService,
  ) {}

  @Public()
  @Post()
  @ApiOperation({ summary: '익명 세션 생성 — { session, token } 반환' })
  create(@Body() dto: CreateSessionDto) {
    return this.service.create(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: '내 세션 조회 (JWT 필요)' })
  me(@Req() req: { user: AnonymousJwtPayload }) {
    return this.service.findById(req.user.sub);
  }

  @ApiBearerAuth()
  @Get('ws-ticket')
  @ApiOperation({ summary: 'WebSocket handshake용 단명(60s) JWT 발급' })
  wsTicket(@Req() req: { user: AnonymousJwtPayload }) {
    const token = this.auth.issueWsTicket({
      sub: req.user.sub,
      nickname: req.user.nickname,
      characterId: req.user.characterId,
    });
    return { token };
  }

  @Public()
  @Get(':deviceId')
  @ApiOperation({ summary: '세션 조회 (deviceId로)' })
  findById(@Param('deviceId') deviceId: string) {
    return this.service.findById(deviceId);
  }
}

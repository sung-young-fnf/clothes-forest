import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AnonymousJwtPayload {
  sub: string;          // deviceId
  nickname: string;
  characterId: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  issueAnonymousToken(payload: AnonymousJwtPayload): string {
    return this.jwt.sign(payload);
  }

  /** WebSocket handshake용 단명 토큰 (60초). 동일 payload, exp만 짧음. */
  issueWsTicket(payload: AnonymousJwtPayload): string {
    return this.jwt.sign(payload, { expiresIn: '60s' });
  }

  /** Chrome Extension 페어링용 단명 nonce (5분). browseSessionId를 함께 인코딩. */
  issuePairNonce(payload: AnonymousJwtPayload, browseSessionId: string): string {
    return this.jwt.sign(
      { ...payload, scope: 'pair', browseSessionId },
      { expiresIn: '300s' },
    );
  }

  /** Pairing nonce를 검증하고 Extension용 30일 디바이스 토큰 + browseSessionId 발급. */
  exchangePairNonce(
    nonce: string,
  ): { token: string; payload: AnonymousJwtPayload; browseSessionId: string } {
    let verified: AnonymousJwtPayload & { scope?: string; browseSessionId?: string };
    try {
      verified = this.jwt.verify(nonce);
    } catch {
      throw new UnauthorizedException('Invalid or expired pair nonce');
    }
    if (verified.scope !== 'pair' || !verified.browseSessionId) {
      throw new UnauthorizedException('Wrong nonce scope');
    }
    const payload: AnonymousJwtPayload = {
      sub: verified.sub,
      nickname: verified.nickname,
      characterId: verified.characterId,
    };
    return {
      token: this.jwt.sign(payload, { expiresIn: '30d' }),
      payload,
      browseSessionId: verified.browseSessionId,
    };
  }

  verifyToken(token: string): AnonymousJwtPayload {
    try {
      return this.jwt.verify<AnonymousJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * AdminGuard — 관리자 전용 엔드포인트 보호
 *
 * 조건 (하나 충족 시 허용):
 * 1. DB User.isAdmin === true
 * 2. JWT roles에 'Admin' 포함
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException('User not authenticated');
    }

    // DB에서 isAdmin 확인
    const dbUser = await this.prisma.reader.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    });

    if (dbUser?.isAdmin) return true;

    // JWT roles 확인 (Azure AD App Roles)
    if (user.roles?.includes('Admin')) return true;

    throw new ForbiddenException('Admin access required');
  }
}

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * RolesGuard — 역할 기반 접근 제어
 *
 * 사용법: @Roles('editor', 'admin') + @UseGuards(RolesGuard)
 * DB UserRole에서 사용자의 역할을 조회하여 매칭
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) throw new ForbiddenException('User not authenticated');

    const userRoles = await this.prisma.reader.userRole.findMany({
      where: { userId },
      include: { role: { select: { name: true } } },
    });

    const roleNames = userRoles.map((ur) => ur.role.name);
    const hasRole = requiredRoles.some((role) => roleNames.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(`Required roles: ${requiredRoles.join(', ')}`);
    }
    return true;
  }
}

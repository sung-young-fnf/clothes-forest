import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MenuQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /** 사용자 역할 기반 메뉴 트리 */
  async getTreeForUser(userId: string) {
    // 사용자의 역할 ID 조회
    const userRoles = await this.prisma.reader.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });
    const roleIds = userRoles.map((ur) => ur.roleId);

    // 역할에 권한이 있는 메뉴만 조회
    const menus = await this.prisma.reader.menu.findMany({
      where: {
        isActive: true,
        permissions: { some: { roleId: { in: roleIds }, canView: true } },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return this.buildTree(menus);
  }

  /** 전체 메뉴 (관리자용) */
  async getAll() {
    const menus = await this.prisma.reader.menu.findMany({
      orderBy: { displayOrder: 'asc' },
      include: { permissions: { include: { role: true } } },
    });
    return this.buildTree(menus);
  }

  /** flat → tree 변환 */
  private buildTree(menus: any[]) {
    const map = new Map(menus.map((m) => [m.id, { ...m, children: [] }]));
    const roots: any[] = [];

    for (const menu of map.values()) {
      if (menu.parentId && map.has(menu.parentId)) {
        map.get(menu.parentId)!.children.push(menu);
      } else {
        roots.push(menu);
      }
    }
    return roots;
  }
}

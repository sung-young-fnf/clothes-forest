import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MenuCommandService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { menuKey: string; label: string; icon?: string; route?: string; parentId?: string }) {
    const exists = await this.prisma.reader.menu.findUnique({ where: { menuKey: data.menuKey } });
    if (exists) throw new ConflictException(`Menu key '${data.menuKey}' already exists`);
    return this.prisma.writer.menu.create({ data });
  }

  async update(id: string, data: { label?: string; icon?: string; route?: string; isActive?: boolean }) {
    const menu = await this.prisma.reader.menu.findUnique({ where: { id } });
    if (!menu) throw new NotFoundException(`Menu ${id} not found`);
    return this.prisma.writer.menu.update({ where: { id }, data });
  }

  async setPermissions(menuId: string, roleIds: string[]) {
    await this.prisma.writer.menuPermission.deleteMany({ where: { menuId } });
    if (roleIds.length) {
      await this.prisma.writer.menuPermission.createMany({
        data: roleIds.map((roleId) => ({ menuId, roleId, canView: true })),
      });
    }
    return this.prisma.reader.menu.findUnique({
      where: { id: menuId },
      include: { permissions: { include: { role: true } } },
    });
  }

  async remove(id: string) {
    const menu = await this.prisma.reader.menu.findUnique({ where: { id } });
    if (!menu) throw new NotFoundException(`Menu ${id} not found`);
    return this.prisma.writer.menu.delete({ where: { id } });
  }
}

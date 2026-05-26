import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** SSO 콜백 시 사용자 자동 등록/업데이트 */
  async upsertFromSSO(data: {
    email: string;
    name?: string;
    entraObjectId: string;
    department?: string;
  }) {
    const user = await this.prisma.writer.user.upsert({
      where: { entraObjectId: data.entraObjectId },
      create: {
        email: data.email,
        name: data.name,
        entraObjectId: data.entraObjectId,
        department: data.department,
      },
      update: {
        email: data.email,
        name: data.name,
        department: data.department,
        lastLoginAt: new Date(),
      },
    });
    this.logger.log(`User upserted: ${user.email}`);
    return user;
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.reader.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { roles: { include: { role: true } } },
      }),
      this.prisma.reader.user.count(),
    ]);
    return { items, total, page, limit };
  }

  async findById(id: string) {
    const user = await this.prisma.reader.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.writer.user.update({ where: { id }, data: { status } });
  }

  async setAdmin(id: string, isAdmin: boolean) {
    return this.prisma.writer.user.update({ where: { id }, data: { isAdmin } });
  }

  async assignRoles(userId: string, roleIds: string[]) {
    await this.prisma.writer.userRole.deleteMany({ where: { userId } });
    await this.prisma.writer.userRole.createMany({
      data: roleIds.map((roleId) => ({ userId, roleId })),
    });
    return this.findById(userId);
  }
}

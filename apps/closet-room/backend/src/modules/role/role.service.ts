import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.reader.role.findMany({ orderBy: { name: 'asc' } });
  }

  async findById(id: string) {
    const role = await this.prisma.reader.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role;
  }

  async create(data: { name: string; description?: string }) {
    const exists = await this.prisma.reader.role.findUnique({ where: { name: data.name } });
    if (exists) throw new ConflictException(`Role '${data.name}' already exists`);
    return this.prisma.writer.role.create({ data });
  }

  async update(id: string, data: { name?: string; description?: string }) {
    await this.findById(id);
    return this.prisma.writer.role.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.writer.role.delete({ where: { id } });
  }
}

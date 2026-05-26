import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExampleDto, UpdateExampleDto } from './dto';

/**
 * ExampleService — 개발 패턴 레퍼런스
 *
 * 패턴:
 * - Reader/Writer 분리: SELECT → prisma.reader, CUD → prisma.writer
 * - DTO로 입력 검증 (class-validator)
 * - Service는 비즈니스 로직만, DB 접근은 Prisma 위임
 * - Controller → Service → Prisma (3-Layer)
 *
 * 실제 앱에서는 이 파일을 복제해서 도메인 모듈을 만드세요.
 * 이 예시 모듈은 Prisma 모델 없이도 구조를 보여주기 위한 것입니다.
 */
@Injectable()
export class ExampleService {
  private readonly logger = new Logger(ExampleService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── READ (reader 사용) ────────────────────────────────

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // reader: SELECT 전용 (Read Replica로 분산)
    const [items, total] = await Promise.all([
      this.prisma.reader.$queryRaw`SELECT 1`, // TODO: prisma.reader.example.findMany(...)
      this.prisma.reader.$queryRaw`SELECT 1`, // TODO: prisma.reader.example.count()
    ]);

    return { items, total, page, limit };
  }

  async findById(id: string) {
    // reader: 단건 조회
    const item = null; // TODO: await this.prisma.reader.example.findUnique({ where: { id } });

    if (!item) {
      throw new NotFoundException(`Example ${id} not found`);
    }
    return item;
  }

  // ─── WRITE (writer 사용) ───────────────────────────────

  async create(dto: CreateExampleDto) {
    // writer: INSERT (Primary DB)
    this.logger.log(`Creating example: ${dto.name}`);
    return { id: 'placeholder', ...dto }; // TODO: this.prisma.writer.example.create({ data: dto })
  }

  async update(id: string, dto: UpdateExampleDto) {
    await this.findById(id); // 존재 확인 (reader)

    // writer: UPDATE
    return { id, ...dto }; // TODO: this.prisma.writer.example.update({ where: { id }, data: dto })
  }

  async remove(id: string) {
    await this.findById(id);

    // writer: DELETE
    return { deleted: true }; // TODO: this.prisma.writer.example.delete({ where: { id } })
  }
}

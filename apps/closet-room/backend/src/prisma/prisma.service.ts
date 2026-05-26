import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService — Global DB 접근 서비스
 *
 * - Writer: INSERT, UPDATE, DELETE (Primary DB)
 * - Reader: SELECT (Read Replica, 프로덕션에서만 분리)
 * - 개발: writer = reader = 동일 DB
 *
 * Connection Pool: DATABASE_URL에 ?connection_limit=15&pool_timeout=30 추가
 * Pod 3개 × 15 = 총 45 커넥션 (Aurora max 범위 내)
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  readonly writer: PrismaClient;
  readonly reader: PrismaClient;

  constructor(private readonly config: ConfigService) {
    const writerUrl = this.config.get<string>('DATABASE_URL');
    const readerUrl = this.config.get<string>('DATABASE_READER_URL') || writerUrl;

    this.writer = new PrismaClient({
      datasources: { db: { url: writerUrl } },
      log: ['warn', 'error'],
    });

    this.reader = new PrismaClient({
      datasources: { db: { url: readerUrl } },
      log: ['warn', 'error'],
    });

    const isReplicaEnabled = writerUrl !== readerUrl;
    this.logger.log(`Prisma initialized — Read Replica: ${isReplicaEnabled ? 'ENABLED' : 'DISABLED'}`);
  }

  async onModuleInit() {
    await Promise.all([this.writer.$connect(), this.reader.$connect()]);
    this.logger.log('Prisma Writer & Reader connected');
  }

  async onModuleDestroy() {
    await Promise.all([this.writer.$disconnect(), this.reader.$disconnect()]);
  }

  async healthCheck() {
    const check = async (client: PrismaClient) => {
      try {
        await client.$queryRaw`SELECT 1`;
        return true;
      } catch {
        return false;
      }
    };
    const [writerOk, readerOk] = await Promise.all([check(this.writer), check(this.reader)]);
    return { writer: writerOk, reader: readerOk };
  }
}

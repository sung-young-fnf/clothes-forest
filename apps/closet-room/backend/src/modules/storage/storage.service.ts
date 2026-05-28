import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

export interface PutResult {
  key: string;
  size: number;
  contentType: string;
}

export interface GetStreamResult {
  stream: Readable;
  size: number;
  contentType: string;
  originalName: string;
}

export interface ListedObject {
  key: string;
  size: number;
  lastModified: Date | undefined;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const endPoint = config.get<string>('MINIO_ENDPOINT', 'minio');
    const port = Number(config.get<string>('MINIO_PORT', '9000'));
    const useSSL =
      (config.get<string>('MINIO_USE_SSL', 'false') ?? 'false').toLowerCase() === 'true';
    const accessKey = config.get<string>('MINIO_ACCESS_KEY', 'minioadmin');
    const secretKey = config.get<string>('MINIO_SECRET_KEY', 'minioadmin');
    this.bucket = config.get<string>('MINIO_BUCKET', 'closet-room');

    this.client = new Client({ endPoint, port, useSSL, accessKey, secretKey });
    this.logger.log(`StorageService 설정 — endpoint=${endPoint}:${port}, bucket=${this.bucket}`);
  }

  /** 부팅 시 버킷 ensure. MinIO 컨테이너가 늦게 뜰 수 있어 최대 10회 retry (20초). */
  async onModuleInit(): Promise<void> {
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const exists = await this.client.bucketExists(this.bucket);
        if (!exists) {
          await this.client.makeBucket(this.bucket);
          this.logger.log(`Bucket 생성: ${this.bucket}`);
        } else {
          this.logger.log(`Bucket 준비됨: ${this.bucket}`);
        }
        return;
      } catch (err) {
        this.logger.warn(
          `MinIO 연결 대기 (${attempt}/10): ${(err as Error).message}`,
        );
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    this.logger.error('MinIO 연결 실패 — 업로드/다운로드 불가 (서비스 부팅은 계속)');
  }

  /**
   * 객체 업로드.
   * key는 자동 생성: `uploads/{YYYY-MM-DD}/{uuid}{ext}`
   * 원본 파일명은 사용자 정의 메타 `x-original-name`에 url-encoded로 저장.
   */
  async putObject(
    originalName: string,
    contentType: string,
    body: Buffer,
  ): Promise<PutResult> {
    const ext = originalName.includes('.') ? '.' + originalName.split('.').pop() : '';
    const datePart = new Date().toISOString().slice(0, 10);
    const key = `uploads/${datePart}/${randomUUID()}${ext}`;

    await this.client.putObject(this.bucket, key, body, body.length, {
      'Content-Type': contentType,
      'X-Original-Name': encodeURIComponent(originalName),
    });
    return { key, size: body.length, contentType };
  }

  /** key로 객체 stream + 메타 반환 */
  async getObjectStream(key: string): Promise<GetStreamResult> {
    const stat = await this.client.statObject(this.bucket, key);
    const stream = await this.client.getObject(this.bucket, key);
    const md = stat.metaData ?? {};
    return {
      stream,
      size: stat.size,
      contentType: md['content-type'] ?? 'application/octet-stream',
      originalName: decodeURIComponent(md['x-original-name'] ?? key),
    };
  }

  /** prefix 하위 객체 목록 (학습/디버깅용) */
  async listObjects(prefix = 'uploads/'): Promise<ListedObject[]> {
    return new Promise((resolve, reject) => {
      const out: ListedObject[] = [];
      const stream = this.client.listObjectsV2(this.bucket, prefix, true);
      stream.on('data', (obj) => {
        if (obj.name) {
          out.push({ key: obj.name, size: obj.size, lastModified: obj.lastModified });
        }
      });
      stream.on('error', reject);
      stream.on('end', () => resolve(out));
    });
  }
}

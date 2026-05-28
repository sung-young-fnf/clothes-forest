import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { StorageService } from './storage.service';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

@ApiTags('Storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('upload')
  @ApiOperation({ summary: '파일 업로드 (multipart/form-data, key: "file") — 최대 10MB' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    required: true,
    description: 'multipart/form-data — `file` 필드에 업로드할 파일 첨부',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('multipart "file" field가 필요합니다.');
    }
    return this.storage.putObject(
      file.originalname ?? 'file.bin',
      file.mimetype ?? 'application/octet-stream',
      file.buffer,
    );
  }

  @Get('list')
  @ApiOperation({ summary: '저장된 객체 목록 (prefix=uploads/, 학습/디버깅용)' })
  async list() {
    const items = await this.storage.listObjects();
    return { count: items.length, items };
  }

  @Get('object')
  @ApiOperation({ summary: '객체 다운로드 — ?key=uploads/YYYY-MM-DD/xxx 형식' })
  async download(
    @Query('key') key: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!key) {
      throw new BadRequestException('key query 파라미터가 필요합니다.');
    }
    try {
      const { stream, size, contentType, originalName } = await this.storage.getObjectStream(key);
      res.set({
        'Content-Type': contentType,
        'Content-Length': String(size),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(originalName)}`,
      });
      return new StreamableFile(stream);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'NotFound' || code === 'NoSuchKey') {
        throw new NotFoundException(`object 없음: ${key}`);
      }
      throw err;
    }
  }
}

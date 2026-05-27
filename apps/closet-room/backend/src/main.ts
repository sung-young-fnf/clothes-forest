import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('bootstrap');

  app.setGlobalPrefix('api');

  // Socket.io Redis pub/sub adapter — 멀티 인스턴스에서 broadcast 동기화
  const redisUrl = process.env.REDIS_URL ?? 'redis://valkey:6379';
  const adapter = new RedisIoAdapter(app);
  try {
    await adapter.connect(redisUrl);
    app.useWebSocketAdapter(adapter);
  } catch (err) {
    logger.warn(`Redis adapter 연결 실패 (${err}). single-instance 모드로 fallback.`);
  }

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('closet-room')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(8000);
}
bootstrap();

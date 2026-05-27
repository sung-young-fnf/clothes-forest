import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import IORedis from 'ioredis';

/**
 * Socket.io Redis pub/sub adapter.
 * 두 BE 인스턴스가 같은 Valkey/Redis를 통해 broadcast를 동기화한다.
 * 사용자가 BE-1에서 emit하면 BE-2의 클라이언트도 그 메시지를 받는다.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  async connect(redisUrl: string): Promise<void> {
    const pubClient = new IORedis(redisUrl);
    const subClient = pubClient.duplicate();
    await Promise.all([
      new Promise<void>((res, rej) => {
        pubClient.once('ready', () => res());
        pubClient.once('error', rej);
      }),
      new Promise<void>((res, rej) => {
        subClient.once('ready', () => res());
        subClient.once('error', rej);
      }),
    ]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log(`Socket.io Redis adapter connected (${redisUrl})`);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      (server as { adapter: (a: unknown) => void }).adapter(this.adapterConstructor);
    }
    return server;
  }
}

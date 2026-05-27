import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import IORedis from 'ioredis';

export interface PresenceEntry {
  deviceId: string;
  nickname: string;
  characterId: string;
  col: number;
  row: number;
  lastActiveAt: number;
}

const ROOM_ID = 'main';
const PRESENCE_KEY = `presence:${ROOM_ID}`;

/**
 * 두 BE 인스턴스 사이에서 공유되는 presence 저장소.
 * Redis Hash로 deviceId → JSON.
 */
@Injectable()
export class RedisStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisStore.name);
  private client!: IORedis;

  async onModuleInit() {
    const url = process.env.REDIS_URL ?? 'redis://valkey:6379';
    this.client = new IORedis(url, { maxRetriesPerRequest: 3 });
    await new Promise<void>((res, rej) => {
      this.client.once('ready', () => res());
      this.client.once('error', rej);
    });
    this.logger.log(`RedisStore connected (${url})`);
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  // ─── Presence ─────────────────────────────────────

  async setPresence(entry: PresenceEntry): Promise<void> {
    await this.client.hset(PRESENCE_KEY, entry.deviceId, JSON.stringify(entry));
  }

  async getPresence(deviceId: string): Promise<PresenceEntry | null> {
    const raw = await this.client.hget(PRESENCE_KEY, deviceId);
    return raw ? (JSON.parse(raw) as PresenceEntry) : null;
  }

  async deletePresence(deviceId: string): Promise<void> {
    await this.client.hdel(PRESENCE_KEY, deviceId);
  }

  async allPresence(): Promise<PresenceEntry[]> {
    const map = await this.client.hgetall(PRESENCE_KEY);
    return Object.values(map).map((v) => JSON.parse(v) as PresenceEntry);
  }

  async touchPresence(deviceId: string, partial: Partial<PresenceEntry>): Promise<PresenceEntry | null> {
    const cur = await this.getPresence(deviceId);
    if (!cur) return null;
    const next: PresenceEntry = { ...cur, ...partial, lastActiveAt: Date.now() };
    await this.setPresence(next);
    return next;
  }

  // ─── Chat rate limit (초당 1 + 분당 30) ──────────────

  /**
   * @returns true 허용 / false 거부
   */
  async allowChat(deviceId: string): Promise<boolean> {
    const secKey = `chat:rate:sec:${deviceId}`;
    const minKey = `chat:rate:min:${deviceId}`;

    const sec = await this.client.incr(secKey);
    if (sec === 1) await this.client.expire(secKey, 1);
    if (sec > 1) return false;

    const min = await this.client.incr(minKey);
    if (min === 1) await this.client.expire(minKey, 60);
    if (min > 30) return false;

    return true;
  }
}

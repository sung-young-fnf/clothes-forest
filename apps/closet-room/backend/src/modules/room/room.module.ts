import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClaudeModule } from '../claude/claude.module';
import { RoomGateway } from './room.gateway';
import { RedisStore } from './redis-stores';

@Module({
  imports: [AuthModule, PrismaModule, ClaudeModule],
  providers: [RoomGateway, RedisStore],
  exports: [RoomGateway],
})
export class RoomModule {}

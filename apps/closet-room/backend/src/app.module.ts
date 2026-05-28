import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UserModule } from './modules/user/user.module';
import { RoleModule } from './modules/role/role.module';
import { MenuModule } from './modules/menu/menu.module';
import { SessionModule } from './modules/session/session.module';
import { RoomModule } from './modules/room/room.module';
import { ChatModule } from './modules/chat/chat.module';
import { ClaudeModule } from './modules/claude/claude.module';
import { BrowseModule } from './modules/browse/browse.module';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    // Built-in RBAC (V1.5 어드민용 보존)
    UserModule,
    RoleModule,
    MenuModule,
    // V1 — Closet Room
    ClaudeModule,
    SessionModule,
    RoomModule,
    ChatModule,
    BrowseModule,
    StorageModule,
  ],
})
export class AppModule {}

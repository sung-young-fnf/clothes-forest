import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { RoomModule } from '../room/room.module';
import { BrowseController } from './browse.controller';
import { BrowseService } from './browse.service';

@Module({
  imports: [AuthModule, RoomModule],
  controllers: [BrowseController],
  providers: [BrowseService],
})
export class BrowseModule {}

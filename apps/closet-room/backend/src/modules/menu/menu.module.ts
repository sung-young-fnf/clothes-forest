import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { MenuQueryService } from './services/menu-query.service';
import { MenuCommandService } from './services/menu-command.service';

@Module({
  controllers: [MenuController],
  providers: [MenuQueryService, MenuCommandService],
  exports: [MenuQueryService],
})
export class MenuModule {}

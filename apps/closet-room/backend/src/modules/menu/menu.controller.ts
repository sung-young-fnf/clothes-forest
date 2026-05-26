import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MenuQueryService } from './services/menu-query.service';
import { MenuCommandService } from './services/menu-command.service';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Menus')
@Controller('menus')
export class MenuController {
  constructor(
    private readonly query: MenuQueryService,
    private readonly command: MenuCommandService,
  ) {}

  @Get('tree')
  @ApiOperation({ summary: '사용자 권한 기반 메뉴 트리' })
  getTree(@CurrentUser('id') userId: string) {
    return this.query.getTreeForUser(userId);
  }

  @Get('all')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '전체 메뉴 목록 (관리자)' })
  getAll() {
    return this.query.getAll();
  }

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '메뉴 생성' })
  create(@Body() dto: { menuKey: string; label: string; icon?: string; route?: string; parentId?: string }) {
    return this.command.create(dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '메뉴 수정' })
  update(@Param('id') id: string, @Body() dto: { label?: string; icon?: string; route?: string; isActive?: boolean }) {
    return this.command.update(id, dto);
  }

  @Patch(':id/permissions')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '메뉴 권한 설정' })
  setPermissions(@Param('id') menuId: string, @Body('roleIds') roleIds: string[]) {
    return this.command.setPermissions(menuId, roleIds);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '메뉴 삭제' })
  remove(@Param('id') id: string) {
    return this.command.remove(id);
  }
}

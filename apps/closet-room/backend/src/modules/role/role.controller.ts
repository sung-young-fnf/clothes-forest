import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Roles')
@Controller('roles')
@UseGuards(AdminGuard)
export class RoleController {
  constructor(private readonly service: RoleService) {}

  @Get()
  @ApiOperation({ summary: '역할 목록' })
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @ApiOperation({ summary: '역할 생성' })
  create(@Body() dto: { name: string; description?: string }) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: '역할 수정' })
  update(@Param('id') id: string, @Body() dto: { name?: string; description?: string }) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '역할 삭제' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

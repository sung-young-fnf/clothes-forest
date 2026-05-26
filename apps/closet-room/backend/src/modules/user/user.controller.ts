import { Controller, Get, Patch, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserService } from './user.service';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly service: UserService) {}

  @Get('me')
  @ApiOperation({ summary: '현재 사용자 정보' })
  getMe(@CurrentUser('id') userId: string) {
    return this.service.findById(userId);
  }

  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '사용자 목록 (관리자)' })
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.service.findAll(+page, +limit);
  }

  @Patch(':id/status')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '사용자 상태 변경' })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.service.updateStatus(id, status);
  }

  @Patch(':id/admin')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '관리자 권한 토글' })
  setAdmin(@Param('id') id: string, @Body('isAdmin') isAdmin: boolean) {
    return this.service.setAdmin(id, isAdmin);
  }

  @Put(':id/roles')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '사용자 역할 할당' })
  assignRoles(@Param('id') id: string, @Body('roleIds') roleIds: string[]) {
    return this.service.assignRoles(id, roleIds);
  }
}

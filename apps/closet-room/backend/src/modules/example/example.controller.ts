import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ExampleService } from './example.service';
import { CreateExampleDto, UpdateExampleDto } from './dto';

/**
 * ExampleController — REST API 레퍼런스
 *
 * 패턴:
 * - Controller는 HTTP 요청/응답만 담당 (비즈니스 로직 금지)
 * - DTO로 입력 검증 (ValidationPipe가 자동 적용)
 * - Service에 위임
 */
@ApiTags('Example')
@Controller('example')
export class ExampleController {
  constructor(private readonly service: ExampleService) {}

  @Get()
  @ApiOperation({ summary: '목록 조회' })
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.service.findAll(+page, +limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '단건 조회' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @ApiOperation({ summary: '생성' })
  create(@Body() dto: CreateExampleDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: '수정' })
  update(@Param('id') id: string, @Body() dto: UpdateExampleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '삭제' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

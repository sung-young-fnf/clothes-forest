import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateExampleDto {
  @ApiProperty({ description: '이름', example: 'My Item' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: '설명' })
  @IsString()
  @IsOptional()
  description?: string;
}

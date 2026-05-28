import { IsIn, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// 사진 레퍼런스 기준 6마리. dog 키는 늑대 텍스처에 매핑됨.
export const CHARACTER_IDS = ['dog', 'cat', 'chicken', 'sheep', 'cow', 'pig'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

export class CreateSessionDto {
  @ApiProperty({ minLength: 2, maxLength: 12, example: '핑크여우' })
  @IsString()
  @Length(2, 12)
  nickname!: string;

  @ApiProperty({ enum: CHARACTER_IDS, example: 'cow' })
  @IsIn(CHARACTER_IDS as unknown as string[])
  characterId!: CharacterId;
}

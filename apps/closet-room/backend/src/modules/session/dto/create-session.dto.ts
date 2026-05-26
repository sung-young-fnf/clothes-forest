import { IsIn, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const CHARACTER_IDS = ['dog', 'cat', 'rabbit', 'fox', 'bear', 'hamster'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

export class CreateSessionDto {
  @ApiProperty({ minLength: 2, maxLength: 12, example: '핑크여우' })
  @IsString()
  @Length(2, 12)
  nickname!: string;

  @ApiProperty({ enum: CHARACTER_IDS, example: 'fox' })
  @IsIn(CHARACTER_IDS as unknown as string[])
  characterId!: CharacterId;
}

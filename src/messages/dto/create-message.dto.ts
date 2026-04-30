import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({
    example: 'hello everyone',
    description: '1-1000 characters, trimmed server-side',
  })
  @IsString()
  content!: string;
}

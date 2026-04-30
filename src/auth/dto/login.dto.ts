import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'ali_123',
    description: '2-24 characters, alphanumeric and underscores only',
  })
  @IsString()
  @Length(2, 24, { message: 'username must be between 2 and 24 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message:
      'username must contain only alphanumeric characters and underscores',
  })
  username!: string;
}

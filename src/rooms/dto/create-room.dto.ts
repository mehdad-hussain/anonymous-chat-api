import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({
    example: 'general',
    description: '3-32 characters, alphanumeric and hyphens only',
  })
  @IsString()
  @Length(3, 32, { message: 'Room name must be between 3 and 32 characters' })
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: 'Room name must contain only alphanumeric characters and hyphens',
  })
  name!: string;
}

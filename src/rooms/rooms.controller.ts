import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/decorators';
import { CurrentUser } from '../common/decorators';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomsService } from './rooms.service';

@ApiTags('rooms')
@ApiBearerAuth('sessionToken')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'List all rooms' })
  @ApiResponse({ status: 200, description: 'Rooms listed' })
  async findAll() {
    const rooms = await this.roomsService.findAll();
    return { rooms };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new room' })
  @ApiResponse({ status: 201, description: 'Room created' })
  @ApiResponse({ status: 409, description: 'Room name already taken' })
  async create(
    @Body() dto: CreateRoomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roomsService.create(dto.name, user.username);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room details' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Room details' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async findOne(@Param('id') id: string) {
    return this.roomsService.findById(id);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a room (creator only)' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Room deleted' })
  @ApiResponse({ status: 403, description: 'Not the room creator' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roomsService.delete(id, user.username);
  }
}

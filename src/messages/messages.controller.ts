import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
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
import { CreateMessageDto } from './dto/create-message.dto';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@ApiBearerAuth('sessionToken')
@Controller('rooms/:id/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated message history for a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Messages retrieved' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async findAll(
    @Param('id') roomId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.messagesService.findByRoom(
      roomId,
      query.limit ?? 50,
      query.before,
    );
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Send a message to a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 422, description: 'Content empty or exceeds limit' })
  async create(
    @Param('id') roomId: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.create(roomId, user.username, dto.content);
  }
}

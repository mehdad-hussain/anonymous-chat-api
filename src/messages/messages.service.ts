import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { and, desc, eq, lt } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ChatGateway } from '../chat/chat.gateway';
import { AppException } from '../common/exceptions/app.exception';
import { genMsgId } from '../common/utils/id.util';
import { DRIZZLE } from '../database/database.module';
import type * as schema from '../database/schema';
import { messages } from '../database/schema';
import { RoomsService } from '../rooms/rooms.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly roomsService: RoomsService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async create(roomId: string, username: string, content: string) {
    // Ensure room exists
    await this.roomsService.ensureRoomExists(roomId);

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      throw new AppException(
        422,
        'MESSAGE_EMPTY',
        'Message content must not be empty',
      );
    }
    if (trimmed.length > 1000) {
      throw new AppException(
        422,
        'MESSAGE_TOO_LONG',
        'Message content must not exceed 1000 characters',
      );
    }

    const id = genMsgId();
    const [created] = await this.db
      .insert(messages)
      .values({ id, roomId, username, content: trimmed })
      .returning();

    this.logger.log({
      msg: 'Message created',
      messageId: id,
      roomId,
      username,
    });

    const messagePayload = {
      id: created.id,
      roomId: created.roomId,
      username: created.username,
      content: created.content,
      createdAt: created.createdAt.toISOString(),
    };

    // Broadcast message:new via WebSocket — spec payload excludes roomId
    this.chatGateway.emitNewMessage(roomId, {
      id: messagePayload.id,
      username: messagePayload.username,
      content: messagePayload.content,
      createdAt: messagePayload.createdAt,
    });

    return messagePayload;
  }

  async findByRoom(roomId: string, limit: number, beforeCursor?: string) {
    // Ensure room exists
    await this.roomsService.ensureRoomExists(roomId);

    const conditions = [eq(messages.roomId, roomId)];

    // If cursor provided, find its timestamp for cursor-based pagination
    if (beforeCursor) {
      const [cursorMsg] = await this.db
        .select()
        .from(messages)
        .where(eq(messages.id, beforeCursor))
        .limit(1);

      if (cursorMsg) {
        conditions.push(lt(messages.createdAt, cursorMsg.createdAt));
      }
    }

    const results = await this.db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const sliced = hasMore ? results.slice(0, limit) : results;

    return {
      messages: sliced.map((m) => ({
        id: m.id,
        roomId: m.roomId,
        username: m.username,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
      hasMore,
      nextCursor: hasMore ? sliced[sliced.length - 1].id : null,
    };
  }
}

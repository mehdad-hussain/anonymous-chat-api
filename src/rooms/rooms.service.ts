import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import Redis from 'ioredis';
import { ChatGateway } from '../chat/chat.gateway';
import { AppException } from '../common/exceptions/app.exception';
import { genRoomId } from '../common/utils/id.util';
import { DRIZZLE } from '../database/database.module';
import type * as schema from '../database/schema';
import { rooms } from '../database/schema';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async findAll() {
    const allRooms = await this.db.select().from(rooms);

    const enriched = await Promise.all(
      allRooms.map(async (room) => ({
        id: room.id,
        name: room.name,
        createdBy: room.createdBy,
        activeUsers: await this.getActiveUserCount(room.id),
        createdAt: room.createdAt.toISOString(),
      })),
    );

    return enriched;
  }

  async findById(id: string) {
    const [room] = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1);

    if (!room) {
      throw new AppException(
        404,
        'ROOM_NOT_FOUND',
        `Room with id ${id} does not exist`,
      );
    }

    return {
      id: room.id,
      name: room.name,
      createdBy: room.createdBy,
      activeUsers: await this.getActiveUserCount(room.id),
      createdAt: room.createdAt.toISOString(),
    };
  }

  async create(name: string, username: string) {
    // Check uniqueness
    const [existing] = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.name, name))
      .limit(1);

    if (existing) {
      throw new AppException(
        409,
        'ROOM_NAME_TAKEN',
        'A room with this name already exists',
      );
    }

    const id = genRoomId();
    const [created] = await this.db
      .insert(rooms)
      .values({ id, name, createdBy: username })
      .returning();

    this.logger.log({
      msg: 'Room created',
      roomId: id,
      name,
      createdBy: username,
    });

    return {
      id: created.id,
      name: created.name,
      createdBy: created.createdBy,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async delete(id: string, username: string) {
    const [room] = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1);

    if (!room) {
      throw new AppException(
        404,
        'ROOM_NOT_FOUND',
        `Room with id ${id} does not exist`,
      );
    }

    if (room.createdBy !== username) {
      throw new AppException(
        403,
        'FORBIDDEN',
        'Only the room creator can delete this room',
      );
    }

    // Emit room:deleted before actually deleting it
    this.chatGateway.emitRoomDeleted(id);

    // Delete room (messages cascade)
    await this.db.delete(rooms).where(eq(rooms.id, id));

    // Clean up Redis active user set
    await this.redis.del(`room:active:${id}`);

    this.logger.log({ msg: 'Room deleted', roomId: id, deletedBy: username });

    return { deleted: true };
  }

  async getActiveUserCount(roomId: string): Promise<number> {
    return this.redis.scard(`room:active:${roomId}`);
  }

  /**
   * Verify a room exists and return it, or throw 404.
   */
  async ensureRoomExists(id: string) {
    const [room] = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1);

    if (!room) {
      throw new AppException(
        404,
        'ROOM_NOT_FOUND',
        `Room with id ${id} does not exist`,
      );
    }

    return room;
  }
}

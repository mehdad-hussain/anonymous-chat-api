import { Inject, Logger, forwardRef } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { SessionService } from '../auth/session.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { RoomsService } from '../rooms/rooms.service';

@WebSocketGateway({ namespace: '/chat', cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly sessionService: SessionService,
    @Inject(forwardRef(() => RoomsService))
    private readonly roomsService: RoomsService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.query.token as string;
      const roomId = socket.handshake.query.roomId as string;

      if (!token || !roomId) {
        this.logger.warn({
          msg: 'Missing token or roomId',
          socketId: socket.id,
        });
        socket.emit('error', { code: 401, message: 'Missing token or roomId' });
        socket.disconnect(true);
        return;
      }

      // Validate session token
      const session = await this.sessionService.validateSession(token);
      if (!session) {
        this.logger.warn({
          msg: 'Invalid or expired token',
          socketId: socket.id,
        });
        socket.emit('error', {
          code: 401,
          message: 'Invalid or expired session token',
        });
        socket.disconnect(true);
        return;
      }

      // Validate room exists
      try {
        await this.roomsService.ensureRoomExists(roomId);
      } catch {
        this.logger.warn({
          msg: 'Room not found',
          roomId,
          socketId: socket.id,
        });
        socket.emit('error', {
          code: 404,
          message: `Room ${roomId} not found`,
        });
        socket.disconnect(true);
        return;
      }

      const { username } = session;

      // Store socket metadata in Redis
      await this.redis.set(
        `socket:${socket.id}`,
        JSON.stringify({ userId: session.userId, username, roomId }),
      );

      // Track this socket for the user/room combination
      await this.redis.sadd(
        `socket:user:${username}:room:${roomId}`,
        socket.id,
      );

      // Add user to active users set
      await this.redis.sadd(`room:active:${roomId}`, username);

      // Join the Socket.io room
      await socket.join(roomId);

      // Get current active users
      const activeUsers = await this.redis.smembers(`room:active:${roomId}`);

      // Emit to connecting client only
      socket.emit('room:joined', { activeUsers });

      // Broadcast to all others in the room
      socket.to(roomId).emit('room:user_joined', { username, activeUsers });

      this.logger.log({
        msg: 'User connected to room',
        username,
        roomId,
        socketId: socket.id,
      });
    } catch (err) {
      this.logger.error({
        msg: 'Error during connection',
        error: (err as Error).message,
        socketId: socket.id,
      });
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    try {
      await this.cleanupSocket(socket.id);
    } catch (err) {
      this.logger.error({
        msg: 'Error during disconnect cleanup',
        error: (err as Error).message,
        socketId: socket.id,
      });
    }
  }

  @SubscribeMessage('room:leave')
  async handleRoomLeave(socket: Socket) {
    try {
      await this.cleanupSocket(socket.id);
      socket.disconnect(true);
    } catch (err) {
      this.logger.error({
        msg: 'Error during room:leave',
        error: (err as Error).message,
        socketId: socket.id,
      });
    }
  }

  /**
   * Emit message:new to all clients in a room.
   * Called by MessagesService after persisting a message.
   */
  emitNewMessage(roomId: string, message: Record<string, unknown>) {
    this.server.to(roomId).emit('message:new', message);
  }

  /**
   * Emit room:deleted to all clients in a room.
   * Called by RoomsService before deleting a room.
   */
  emitRoomDeleted(roomId: string) {
    this.server.to(roomId).emit('room:deleted', { roomId });
  }

  /**
   * Clean up a socket: remove from Redis tracking, update active users, broadcast leave.
   */
  private async cleanupSocket(socketId: string) {
    const raw = await this.redis.get(`socket:${socketId}`);
    if (!raw) return;

    const { username, roomId } = JSON.parse(raw) as {
      username: string;
      roomId: string;
    };

    // Remove this socket from user's socket set for this room
    await this.redis.srem(`socket:user:${username}:room:${roomId}`, socketId);

    // Check if user still has other sockets in this room
    const remainingSockets = await this.redis.scard(
      `socket:user:${username}:room:${roomId}`,
    );

    if (remainingSockets === 0) {
      // User fully left — remove from active set
      await this.redis.srem(`room:active:${roomId}`, username);
      // Clean up empty set key
      await this.redis.del(`socket:user:${username}:room:${roomId}`);
    }

    // Remove socket metadata
    await this.redis.del(`socket:${socketId}`);

    // Get updated active users and broadcast
    const activeUsers = await this.redis.smembers(`room:active:${roomId}`);

    // Only broadcast leave if user fully disconnected from room
    if (remainingSockets === 0) {
      this.server.to(roomId).emit('room:user_left', { username, activeUsers });
    }

    this.logger.log({ msg: 'Socket cleaned up', username, roomId, socketId });
  }
}

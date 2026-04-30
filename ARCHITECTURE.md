# Architecture Document

## Overview

The Anonymous Chat API is built with a decoupled architecture utilizing **NestJS** as the core framework, **PostgreSQL** (via **Drizzle ORM**) for persistent storage, and **Redis** for ephemeral data, presence tracking, and real-time event fan-out. The real-time capabilities are exposed via **Socket.io**.

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Clients                                 │
│            (Browser / Mobile / Test Scripts)                    │
└────────────┬────────────────────────────┬───────────────────────┘
             │  HTTP REST  /api/v1         │  WebSocket  /chat
             ▼                            ▼
┌────────────────────────────────────────────────────────────────┐
│                    NestJS Application                          │
│                                                                │
│  ┌──────────────────┐        ┌──────────────────────────────┐  │
│  │  REST Controllers│        │     ChatGateway (Socket.io)  │  │
│  │  /login          │        │     namespace: /chat         │  │
│  │  /rooms          │        │                              │  │
│  │  /rooms/:id/msgs │        │  handleConnection()          │  │
│  └────────┬─────────┘        │  handleDisconnect()          │  │
│           │                  │  @SubscribeMessage(room:leave)│  │
│           ▼                  └──────────┬───────────────────┘  │
│  ┌──────────────────────────────────────┴───────────────────┐  │
│  │                    Services                               │  │
│  │  AuthService · SessionService · RoomsService             │  │
│  │  MessagesService                                         │  │
│  └──────┬──────────────────────────────────────┬───────────┘  │
│         │ Drizzle ORM                           │ ioredis       │
└─────────┼───────────────────────────────────────┼──────────────┘
          ▼                                        ▼
  ┌───────────────┐                    ┌───────────────────────┐
  │  PostgreSQL   │                    │         Redis         │
  │               │                    │                       │
  │  users        │                    │  session:<token>      │
  │  rooms        │                    │  room:active:<id>     │
  │  messages     │                    │  socket:<socketId>    │
  └───────────────┘                    │  Pub/Sub (WS fan-out) │
                                       └───────────────────────┘
```

### Request Flow
1. **REST API**: Handles all data mutation (creating rooms, sending messages, authentication).
2. **WebSocket Gateway**: A read-only event distribution layer. Messages and state changes initiated via REST are broadcast to connected clients via the Gateway.
3. **Redis Pub/Sub**: Acts as the communication bus between multiple NestJS server instances, ensuring that a message posted to Server A is delivered to clients connected to Server B.

## Session Strategy

Authentication is entirely anonymous and stateless from the client's perspective (no passwords).
- **Token Generation**: On `POST /login`, a 48-character cryptographically secure token (`nanoid`) is generated.
- **Storage**: The token is stored in Redis as `session:<token>` with a JSON payload `{ userId, username }` and a TTL of 24 hours.
- **Validation**: 
  - REST endpoints are protected by an `AuthGuard` that looks up the token in Redis on every request.
  - WebSocket connections validate the token on `connection`. If the token expires or is invalid, the connection is rejected or terminated.

## WebSocket Fan-out via Redis Pub/Sub

The WebSocket gateway (`/chat`) scales horizontally using the `@socket.io/redis-adapter`.
- When `MessagesService.create()` inserts a message into PostgreSQL, it explicitly calls `chatGateway.emitNewMessage()`.
- The gateway calls `server.to(roomId).emit(...)`.
- The Redis Adapter intercepts this broadcast, publishes the event to a Redis Pub/Sub channel, and all connected Socket.io server instances receive the event and push it to their local connected clients in that room.

## Capacity Estimation

**Single Instance Capacity**: ~5,000 to 10,000 concurrent WebSocket connections.
- **Reasoning**: Node.js can handle tens of thousands of idle WebSockets. The limiting factors here are memory (tracking socket instances) and Redis I/O (presence tracking and Pub/Sub). Since each message sent involves a PostgreSQL write, a Redis read (for active users), and a Redis publish, the CPU will likely bottleneck around 2,000–3,000 messages per second on a standard 2vCPU/4GB instance.

## Scaling to 10× the Load

To handle 100,000+ concurrent connections:
1. **Redis Cluster**: Shard the session data and active user sets across a Redis cluster to prevent a single Redis node from becoming a memory/CPU bottleneck.
2. **Message Queue for Writes**: Instead of writing messages synchronously to PostgreSQL, publish them to a Kafka or RabbitMQ queue. A separate worker pool would batch-insert messages into the database, dramatically reducing connection pool exhaustion.
3. **PgBouncer**: Implement connection pooling for PostgreSQL to prevent the database from being overwhelmed by simultaneous connections from multiple API instances.

## Trade-offs & Known Limitations

- **Eventual Consistency in User Counts**: The `activeUsers` count fetched from Redis during `GET /rooms` might be slightly stale for a few milliseconds during high churn.
- **No Rate Limiting**: Currently, there is no protection against spam or brute-force API usage. Implementing `@nestjs/throttler` (backed by Redis) would be necessary for production.
- **Immutable Usernames**: Because `createdBy` on rooms stores the string `username` directly, usernames cannot be changed without migrating all related records. This trade-off was made for simplicity, aligning with the "anonymous/no-registration" requirement.

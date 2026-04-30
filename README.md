# Anonymous Chat API

A real-time group chat service built with **NestJS**, **PostgreSQL**, **Drizzle ORM**, **Redis**, and **Socket.io**.

## Features

- Anonymous login (username only, no passwords).
- Create, list, and join chat rooms.
- Real-time message broadcasting and active user tracking.
- Stateless REST API using Bearer tokens (stored in Redis).
- Horizontally scalable WebSockets using Redis Pub/Sub adapter.
- Interactive OpenAPI documentation powered by **Scalar**.
- Structured logging using **Pino**.

## Prerequisites

- Node.js (v18+)
- pnpm (`npm install -g pnpm`)
- Docker & Docker Compose (for local database & Redis)

## Setup & Installation

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Start Infrastructure**:
   Spin up PostgreSQL and Redis using Docker Compose.
   ```bash
   docker compose up -d
   ```

3. **Database Migration**:
   Push the Drizzle ORM schema to the PostgreSQL database.
   ```bash
   pnpm drizzle-kit push
   ```

4. **Start Application**:
   ```bash
   pnpm run start:dev
   ```

## Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgres://chat:chat@localhost:5432/anonymous_chat
REDIS_URL=redis://localhost:6379
SESSION_TTL_SECONDS=86400
PORT=3000
NODE_ENV=development
```

> In production, set `NODE_ENV=production` and use the connection strings provided by your hosting platform.

## Documentation

Interactive API documentation is automatically generated. Once the application is running, navigate to:

```
http://localhost:3000/api/docs
```

## Testing

```bash
# Unit tests
pnpm run test

# End-to-end tests
pnpm run test:e2e
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed information on the design decisions, session strategy, and scaling limitations.

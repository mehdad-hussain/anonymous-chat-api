import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './chat/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // ── Pino Logger ──
  const logger = app.get(Logger);
  app.useLogger(logger);

  // ── Global Prefix ──
  app.setGlobalPrefix('api/v1');

  // ── Validation ──
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // ── Get Configuration ──
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;
  const databaseUrl = configService.get<string>('DATABASE_URL');
  const redisUrl = configService.get<string>('REDIS_URL');
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';

  // Log database connection
  if (databaseUrl) {
    const dbHost = databaseUrl.split('@')[1]?.split(':')[0] || 'unknown';
    const dbName = databaseUrl.split('/').pop() || 'unknown';
    logger.log({
      msg: 'Database connected',
      host: dbHost,
      database: dbName,
      environment: nodeEnv,
    });
  }

  // ── Redis IoAdapter ──
  const redisIoAdapter = new RedisIoAdapter(app, configService);
  redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);
  if (redisUrl) {
    const redisHost = redisUrl.split('@')[1]?.split(':')[0] || 'localhost';
    logger.log({ msg: 'Redis connected', host: redisHost });
  }

  // ── Scalar OpenAPI Docs ──
  const config = new DocumentBuilder()
    .setTitle('Anonymous Chat API')
    .setDescription('Real-time anonymous group chat service')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'sessionToken')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  // Serve raw OpenAPI JSON at /api/docs/openapi.json
  SwaggerModule.setup('api/docs/swagger', app, document);

  // Serve Scalar UI at /api/docs — with deep space theme
  app.use(
    '/api/docs',
    apiReference({
      content: document,
      theme: 'deepSpace',
      darkMode: true,

      defaultHttpClient: {
        targetKey: 'js',
        clientKey: 'axios',
      },
    }),
  );

  // ── CORS ──
  app.enableCors();

  // ── Start Server ──
  await app.listen(port);

  logger.log({
    msg: 'Server started successfully',
    port,
    environment: nodeEnv,
    apiPrefix: '/api/v1',
    websocket: { namespace: '/chat', cors: true },
    docs: {
      scalar: `http://localhost:${port}/api/docs`,
      swagger: `http://localhost:${port}/api/docs/swagger`,
      openapi: `http://localhost:${port}/api/docs/swagger-ui.json`,
    },
  });
}
bootstrap();

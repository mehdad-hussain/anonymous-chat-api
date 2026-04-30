import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (!redisUrl) {
          throw new Error('REDIS_URL is not defined');
        }
        const isTls = redisUrl.startsWith('rediss://');
        return new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => Math.min(times * 100, 3000),
          ...(isTls && { tls: {} }),
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}

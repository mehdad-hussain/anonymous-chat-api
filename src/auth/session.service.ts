import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { genSessionToken } from '../common/utils/id.util';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly sessionTtl: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.sessionTtl = this.configService.get<number>(
      'SESSION_TTL_SECONDS',
      86400,
    );
  }

  /**
   * Create a new session token and store it in Redis with TTL.
   */
  async createSession(userId: string, username: string): Promise<string> {
    const token = genSessionToken();
    const payload = JSON.stringify({ userId, username });
    await this.redis.set(`session:${token}`, payload, 'EX', this.sessionTtl);
    this.logger.log({ msg: 'Session created', userId, username });
    return token;
  }

  /**
   * Validate a session token. Returns the user payload or null.
   */
  async validateSession(
    token: string,
  ): Promise<{ userId: string; username: string } | null> {
    const data = await this.redis.get(`session:${token}`);
    if (!data) return null;
    try {
      return JSON.parse(data) as { userId: string; username: string };
    } catch {
      this.logger.error({
        msg: 'Corrupted session data',
        token: token.slice(0, 8),
      });
      return null;
    }
  }
}

import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.module';
import { users } from '../database/schema';
import { genUserId } from '../common/utils/id.util';
import { SessionService } from './session.service';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../database/schema';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Login: find or create user by username, then issue a fresh session token.
   */
  async login(username: string) {
    // Find existing user
    const [existing] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    let user: typeof existing;

    if (existing) {
      user = existing;
      this.logger.log({
        msg: 'Existing user logged in',
        userId: user.id,
        username,
      });
    } else {
      const id = genUserId();
      const [created] = await this.db
        .insert(users)
        .values({ id, username })
        .returning();
      user = created;
      this.logger.log({ msg: 'New user created', userId: user.id, username });
    }

    const sessionToken = await this.sessionService.createSession(
      user.id,
      user.username,
    );

    return {
      sessionToken,
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }
}

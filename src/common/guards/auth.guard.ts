import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionService } from '../../auth/session.service';
import { IS_PUBLIC_KEY } from '../decorators';
import { AppException } from '../exceptions/app.exception';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip auth for @Public() routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppException(
        401,
        'UNAUTHORIZED',
        'Missing or expired session token',
      );
    }

    const token = authHeader.slice(7);
    const session = await this.sessionService.validateSession(token);

    if (!session) {
      throw new AppException(
        401,
        'UNAUTHORIZED',
        'Missing or expired session token',
      );
    }

    request.user = session;

    return true;
  }
}

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark an endpoint as public — the AuthGuard will skip token validation.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

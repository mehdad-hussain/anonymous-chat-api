import { HttpException } from '@nestjs/common';

/**
 * Custom application exception that carries a machine-readable error code.
 * The GlobalExceptionFilter reads `code` from the response object.
 */
export class AppException extends HttpException {
  constructor(status: number, code: string, message: string) {
    super({ code, message }, status);
  }
}

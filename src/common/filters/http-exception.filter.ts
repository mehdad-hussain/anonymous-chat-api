import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        code = (res.code as string) || this.statusToCode(status);
        message = (res.message as string) || exception.message;

        // Handle class-validator errors (array of messages)
        if (Array.isArray(res.message)) {
          code = 'VALIDATION_ERROR';
          message = (res.message as string[]).join(', ');
        }
      } else {
        code = this.statusToCode(status);
        message = String(exceptionResponse);
      }
    } else if (exception instanceof Error) {
      this.logger.error({
        msg: 'Unhandled exception',
        error: exception.message,
        stack: exception.stack,
      });
    }

    response.status(status).json({
      success: false,
      error: { code, message },
    });
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
    };
    return map[status] || 'INTERNAL_ERROR';
  }
}

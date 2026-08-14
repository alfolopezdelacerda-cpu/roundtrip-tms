import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import logger from '../logger';

/**
 * Filtro global de errores.
 *
 * Regla de seguridad: hacia fuera solo sale un mensaje seguro y un
 * `errorId`; el detalle real (stack, query, driver) queda en el log. Así se
 * evita el information disclosure del OWASP A01/A05 sin perder trazabilidad:
 * el usuario reporta el `errorId` y se localiza el evento exacto.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorId = randomUUID();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: Record<string, unknown> = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      errorId,
    };

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      // ValidationPipe devuelve un objeto con `errors`; se conserva tal cual
      // porque es información que el cliente necesita para corregir su envío.
      if (typeof payload === 'string') {
        body.message = payload;
      } else {
        Object.assign(body, payload);
      }
    } else {
      body.message = 'Internal server error';
    }

    const nivel5xx = status >= HttpStatus.INTERNAL_SERVER_ERROR;
    const detalle = {
      errorId,
      method: request.method,
      path: request.url,
      status,
      ip: request.ip,
    };

    if (nivel5xx) {
      logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception,
        'ExceptionFilter',
      );
      logger.audit({ tipo: 'error_no_controlado', ...detalle });
    } else {
      logger.warn(
        `${request.method} ${request.url} -> ${status} (errorId=${errorId})`,
        'ExceptionFilter',
      );
    }

    response.status(status).json(body);
  }
}

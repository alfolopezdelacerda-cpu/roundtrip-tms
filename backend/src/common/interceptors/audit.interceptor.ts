import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import logger from '../logger';

type UsuarioAutenticado = { id?: string; email?: string; role?: string };

/**
 * Bitácora global de peticiones.
 *
 * Se registra en `main.ts` con `new AuditInterceptor()`, es decir fuera del
 * contenedor de DI, así que aquí no se puede inyectar un repositorio. Por eso
 * la auditoría sale por el logger (y de ahí a Elasticsearch).
 *
 * Para persistir en `monitoreo_db.auditoria_sistema` hay que registrarlo como
 * `APP_INTERCEPTOR` en un módulo e inyectar el repositorio; está pendiente y
 * anotado en el README.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  /** Acciones que modifican estado: son las que importan en la bitácora. */
  private readonly metodoAccion: Record<string, string> = {
    POST: 'CREATE',
    GET: 'READ',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
  };

  /** Nunca deben aparecer en el log, aunque vengan en el cuerpo. */
  private readonly camposSensibles = [
    'password',
    'passwordHash',
    'password_hash',
    'token',
    'refreshToken',
    'accessToken',
    'clientSecret',
    'mfaSecret',
    'mfa_secret',
    'totp',
    'rfc',
    'curp',
    'clabe',
    'cuentaBancaria',
  ];

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const inicio = Date.now();
    const usuario = (request as Request & { user?: UsuarioAutenticado }).user;

    const base = {
      accion: this.metodoAccion[request.method] ?? request.method,
      entidad: this.entidadDesdeRuta(request.url),
      method: request.method,
      path: request.url,
      usuarioId: usuario?.id ?? null,
      usuarioEmail: usuario?.email ?? null,
      ip: request.ip,
      userAgent: request.get?.('user-agent')?.slice(0, 500) ?? null,
    };

    return next.handle().pipe(
      tap({
        next: () => {
          // Las lecturas se registran solo en debug: auditar cada GET satura
          // el índice sin aportar nada a la trazabilidad de cambios.
          if (base.accion === 'READ') {
            logger.debug(
              `${request.method} ${request.url} (${Date.now() - inicio}ms)`,
              'Audit',
            );
            return;
          }
          logger.audit({
            ...base,
            resultado: 'ok',
            duracionMs: Date.now() - inicio,
            payload: this.sanitizar(request.body),
          });
        },
        error: (error: unknown) => {
          logger.audit({
            ...base,
            resultado: 'error',
            duracionMs: Date.now() - inicio,
            mensaje: error instanceof Error ? error.message : String(error),
          });
        },
      }),
    );
  }

  /** `/api/v1/vehiculos/uuid` -> `vehiculos` */
  private entidadDesdeRuta(url: string): string {
    const limpia = url.split('?')[0];
    const partes = limpia.split('/').filter(Boolean);
    const idx = partes.findIndex((p) => /^v\d+$/.test(p));
    return partes[idx + 1] ?? partes[partes.length - 1] ?? 'desconocida';
  }

  private sanitizar(body: unknown): unknown {
    if (!body || typeof body !== 'object') return undefined;
    if (Array.isArray(body)) return body.map((item) => this.sanitizar(item));

    const salida: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(body as Record<string, unknown>)) {
      if (this.camposSensibles.some((c) => clave.toLowerCase().includes(c.toLowerCase()))) {
        salida[clave] = '[REDACTADO]';
      } else if (valor && typeof valor === 'object') {
        salida[clave] = this.sanitizar(valor);
      } else {
        salida[clave] = valor;
      }
    }
    return salida;
  }
}

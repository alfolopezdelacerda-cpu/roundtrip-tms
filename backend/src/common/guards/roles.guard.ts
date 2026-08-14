import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY, type UsuarioPeticion } from '../decorators';
import type { RolUsuario } from '../../modules/auth/entities/user.entity';
import logger from '../logger';

/** RBAC: valida el rol que `JwtStrategy` puso en la petición. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<RolUsuario[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requeridos || requeridos.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: UsuarioPeticion }>();
    const usuario = request.user;

    if (!usuario || !requeridos.includes(usuario.role)) {
      logger.audit({
        tipo: 'acceso_denegado',
        path: request.url,
        usuarioId: usuario?.id ?? null,
        rol: usuario?.role ?? null,
        requeridos,
      });
      throw new ForbiddenException('No tiene permisos para esta operación');
    }

    return true;
  }
}

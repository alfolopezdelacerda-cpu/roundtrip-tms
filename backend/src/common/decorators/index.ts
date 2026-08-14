import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { RolUsuario } from '../../modules/auth/entities/user.entity';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Marca un endpoint como accesible sin JWT (login, health, track&trace público). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restringe un endpoint a los roles indicados. Requiere `RolesGuard`. */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);

export type UsuarioPeticion = {
  id: string;
  email: string;
  username: string;
  role: RolUsuario;
  keycloakId?: string | null;
};

/** Inyecta el usuario que colocó la estrategia JWT en la petición. */
export const CurrentUser = createParamDecorator(
  (campo: keyof UsuarioPeticion | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: UsuarioPeticion }>();
    const usuario = request.user;
    if (!usuario) return undefined;
    return campo ? usuario[campo] : usuario;
  },
);

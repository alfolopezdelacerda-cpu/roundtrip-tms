import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, type PayloadJwt } from '../auth.service';
import type { UsuarioPeticion } from '../../../common/decorators';

/**
 * Estrategia por defecto: valida el access token emitido por este backend.
 *
 * Lo que devuelve `validate` es lo que queda en `request.user` y lo que leen
 * `RolesGuard`, `@CurrentUser()` y el interceptor de auditoría.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'dev-secret-min-32-chars-required'),
      issuer: 'roundtrip-tms',
      algorithms: ['HS256'],
    });
  }

  async validate(payload: PayloadJwt): Promise<UsuarioPeticion> {
    if (payload.tipo !== 'access') {
      throw new UnauthorizedException('Se requiere un access token');
    }

    // Un token con firma válida puede haber sido revocado (logout, rotación).
    if (await this.authService.estaRevocado(payload.jti)) {
      throw new UnauthorizedException('Token revocado');
    }

    // Se relee el usuario para que un cambio de rol o una baja surta efecto
    // sin esperar a que caduque el token.
    const usuario = await this.authService.obtenerUsuario(payload.sub);
    if (!usuario.isActive) {
      throw new UnauthorizedException('Cuenta desactivada');
    }

    return {
      id: usuario.id,
      email: usuario.email,
      username: usuario.username,
      role: usuario.role,
      keycloakId: usuario.keycloakId,
    };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, type PayloadJwt } from '../auth.service';

/**
 * Valida el refresh token. Va con secreto propio (`JWT_REFRESH_SECRET`) para
 * que filtrar el secreto de acceso no permita emitir sesiones nuevas.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_REFRESH_SECRET',
        configService.get<string>('JWT_SECRET', 'dev-secret-min-32-chars-required'),
      ),
      issuer: 'roundtrip-tms',
      algorithms: ['HS256'],
    });
  }

  async validate(payload: PayloadJwt): Promise<PayloadJwt> {
    if (payload.tipo !== 'refresh') {
      throw new UnauthorizedException('Se requiere un refresh token');
    }
    if (await this.authService.estaRevocado(payload.jti)) {
      throw new UnauthorizedException('Token revocado');
    }
    return payload;
  }
}

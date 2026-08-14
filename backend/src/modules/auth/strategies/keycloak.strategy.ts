import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { createPublicKey, type JsonWebKey } from 'crypto';
import { AuthService } from '../auth.service';
import { KeycloakService } from '../services/keycloak.service';
import type { UsuarioPeticion } from '../../../common/decorators';
import logger from '../../../common/logger';

type PayloadKeycloak = {
  sub: string;
  email?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
};

/**
 * Acepta access tokens emitidos directamente por Keycloak (RS256), para
 * clientes que hablan con el realm sin pasar por `/auth/login`.
 *
 * La clave pública se resuelve por `kid` contra el JWKS del realm, que
 * `KeycloakService` cachea.
 */
@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, 'keycloak') {
  constructor(
    private readonly keycloakService: KeycloakService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      issuer: keycloakService.issuer,
      secretOrKeyProvider: (
        _request: unknown,
        rawJwtToken: string,
        done: (err: Error | null, clave?: string) => void,
      ) => {
        this.resolverClave(rawJwtToken)
          .then((clave) => done(null, clave))
          .catch((error: Error) => done(error));
      },
    });
  }

  private async resolverClave(rawJwtToken: string): Promise<string> {
    const kid = this.leerKid(rawJwtToken);
    const claves = await this.keycloakService.obtenerJwks();
    const jwk = claves.find((k) => k.kid === kid);

    if (!jwk) {
      logger.warn(`Token con kid desconocido: ${kid}`, 'KeycloakStrategy');
      throw new UnauthorizedException('Token de Keycloak no verificable');
    }

    return createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' })
      .export({ type: 'spki', format: 'pem' })
      .toString();
  }

  private leerKid(rawJwtToken: string): string {
    const [header] = rawJwtToken.split('.');
    if (!header) throw new UnauthorizedException('Token malformado');
    try {
      const decodificado = JSON.parse(
        Buffer.from(header, 'base64url').toString('utf8'),
      ) as { kid?: string };
      if (!decodificado.kid) throw new Error('sin kid');
      return decodificado.kid;
    } catch {
      throw new UnauthorizedException('Token malformado');
    }
  }

  async validate(payload: PayloadKeycloak): Promise<UsuarioPeticion> {
    if (!payload.email || !payload.preferred_username) {
      throw new UnauthorizedException('El token de Keycloak no incluye email ni usuario');
    }

    const usuario = await this.authService.sincronizarDesdeKeycloak({
      keycloakId: payload.sub,
      email: payload.email,
      username: payload.preferred_username,
      roles: payload.realm_access?.roles,
    });

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

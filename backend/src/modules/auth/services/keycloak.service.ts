import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import logger from '../../../common/logger';

type TokenKeycloak = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

type UserInfoKeycloak = {
  sub: string;
  email?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: { roles?: string[] };
};

type JwkKeycloak = {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
  x5c?: string[];
};

/**
 * Cliente del realm de Keycloak.
 *
 * Se usa `fetch` nativo (Node 20+) en lugar de axios para no arrastrar otra
 * dependencia en la ruta de autenticación.
 */
@Injectable()
export class KeycloakService {
  private readonly baseUrl: string;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  /** Caché de claves públicas del realm; Keycloak las rota con poca frecuencia. */
  private jwksCache: { claves: JwkKeycloak[]; expira: number } | null = null;
  private readonly jwksTtlMs = 10 * 60 * 1000;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService
      .get<string>('KEYCLOAK_URL', 'http://localhost:8080')
      .replace(/\/$/, '');
    this.realm = this.configService.get<string>('KEYCLOAK_REALM', 'roundtrip-tms');
    this.clientId = this.configService.get<string>('KEYCLOAK_CLIENT_ID', 'roundtrip-backend');
    this.clientSecret = this.configService.get<string>('KEYCLOAK_CLIENT_SECRET', '');
  }

  get issuer(): string {
    return `${this.baseUrl}/realms/${this.realm}`;
  }

  get jwksUri(): string {
    return `${this.issuer}/protocol/openid-connect/certs`;
  }

  /** Login por contraseña (grant `password`) contra el realm. */
  async autenticar(username: string, password: string): Promise<TokenKeycloak> {
    const cuerpo = new URLSearchParams({
      grant_type: 'password',
      client_id: this.clientId,
      username,
      password,
    });
    if (this.clientSecret) cuerpo.set('client_secret', this.clientSecret);

    const respuesta = await this.peticion('/protocol/openid-connect/token', cuerpo);

    if (respuesta.status === 401) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!respuesta.ok) {
      logger.error(
        `Keycloak respondió ${respuesta.status} al autenticar`,
        await respuesta.text(),
        'KeycloakService',
      );
      throw new ServiceUnavailableException('Servicio de autenticación no disponible');
    }

    return (await respuesta.json()) as TokenKeycloak;
  }

  /** Renueva el par de tokens a partir del refresh token del realm. */
  async refrescar(refreshToken: string): Promise<TokenKeycloak> {
    const cuerpo = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      refresh_token: refreshToken,
    });
    if (this.clientSecret) cuerpo.set('client_secret', this.clientSecret);

    const respuesta = await this.peticion('/protocol/openid-connect/token', cuerpo);
    if (!respuesta.ok) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
    return (await respuesta.json()) as TokenKeycloak;
  }

  /** Cierra la sesión en el realm (invalida el refresh token). */
  async cerrarSesion(refreshToken: string): Promise<void> {
    const cuerpo = new URLSearchParams({
      client_id: this.clientId,
      refresh_token: refreshToken,
    });
    if (this.clientSecret) cuerpo.set('client_secret', this.clientSecret);

    const respuesta = await this.peticion('/protocol/openid-connect/logout', cuerpo);
    if (!respuesta.ok) {
      // El logout local ya ocurrió; que el realm falle no debe romper la
      // petición del usuario, pero sí queda registrado.
      logger.warn(`Keycloak respondió ${respuesta.status} al cerrar sesión`, 'KeycloakService');
    }
  }

  /** Datos del usuario asociados a un access token del realm. */
  async obtenerUsuario(accessToken: string): Promise<UserInfoKeycloak> {
    const respuesta = await fetch(`${this.issuer}/protocol/openid-connect/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!respuesta.ok) {
      throw new UnauthorizedException('Token de Keycloak inválido');
    }
    return (await respuesta.json()) as UserInfoKeycloak;
  }

  /** Claves públicas del realm, cacheadas para validar firmas RS256. */
  async obtenerJwks(): Promise<JwkKeycloak[]> {
    if (this.jwksCache && this.jwksCache.expira > Date.now()) {
      return this.jwksCache.claves;
    }

    const respuesta = await fetch(this.jwksUri);
    if (!respuesta.ok) {
      throw new ServiceUnavailableException('No se pudieron obtener las claves de Keycloak');
    }

    const { keys } = (await respuesta.json()) as { keys: JwkKeycloak[] };
    this.jwksCache = { claves: keys, expira: Date.now() + this.jwksTtlMs };
    return keys;
  }

  private peticion(ruta: string, cuerpo: URLSearchParams): Promise<Response> {
    return fetch(`${this.issuer}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: cuerpo,
    });
  }
}

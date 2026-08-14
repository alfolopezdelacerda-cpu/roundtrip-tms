import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { User, type RolUsuario } from './entities/user.entity';
import { TokenBlacklist } from './entities/token-blacklist.entity';
import { MfaService } from './services/mfa.service';
import { KeycloakService } from './services/keycloak.service';
import { EncryptionService } from '../../security/encryption/encryption.service';
import type { LoginDto, RegisterDto } from './dto/auth.dto';
import logger from '../../common/logger';

export type PayloadJwt = {
  sub: string;
  email: string;
  username: string;
  role: RolUsuario;
  jti: string;
  tipo: 'access' | 'refresh';
};

export type ParTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
};

/** Umbral de bloqueo por fuerza bruta, complementa el rate limit de `main.ts`. */
const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usuarios: Repository<User>,
    @InjectRepository(TokenBlacklist)
    private readonly listaNegra: Repository<TokenBlacklist>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mfaService: MfaService,
    private readonly keycloakService: KeycloakService,
    private readonly encryption: EncryptionService,
  ) {}

  // ============================================
  // Registro
  // ============================================

  async registrar(dto: RegisterDto, creadoPorId?: string): Promise<User> {
    const existente = await this.usuarios.findOne({
      where: [{ email: dto.email }, { username: dto.username }],
      withDeleted: true,
    });
    if (existente) {
      throw new ConflictException('El email o usuario ya está registrado');
    }

    const usuario = this.usuarios.create({
      email: dto.email,
      username: dto.username,
      passwordHash: this.encryption.hashPassword(dto.password),
      firstName: dto.firstName ?? null,
      lastName: dto.lastName ?? null,
      role: 'dispatcher',
      createdById: creadoPorId ?? null,
    });

    const guardado = await this.usuarios.save(usuario);
    logger.audit({ tipo: 'usuario_creado', usuarioId: guardado.id, email: guardado.email });
    return guardado;
  }

  // ============================================
  // Login
  // ============================================

  async login(dto: LoginDto, ip?: string): Promise<ParTokens & { mfaRequerido?: boolean }> {
    const usuario = await this.usuarios
      .createQueryBuilder('u')
      .addSelect(['u.passwordHash', 'u.mfaSecret', 'u.mfaBackupCodes'])
      .where('u.email = :email', { email: dto.email })
      .getOne();

    // Mensaje idéntico para usuario inexistente y contraseña incorrecta: no
    // se debe permitir enumerar cuentas.
    const credencialesInvalidas = new UnauthorizedException('Credenciales inválidas');

    if (!usuario) {
      logger.audit({ tipo: 'login_fallido', motivo: 'usuario_inexistente', email: dto.email, ip });
      throw credencialesInvalidas;
    }

    if (!usuario.isActive) {
      throw new UnauthorizedException('Cuenta desactivada');
    }

    if (usuario.lockedUntil && usuario.lockedUntil > new Date()) {
      logger.audit({ tipo: 'login_bloqueado', usuarioId: usuario.id, ip });
      throw new UnauthorizedException(
        `Cuenta bloqueada temporalmente. Intente después de ${usuario.lockedUntil.toISOString()}`,
      );
    }

    if (!this.encryption.verifyPassword(dto.password, usuario.passwordHash)) {
      await this.registrarIntentoFallido(usuario, ip);
      throw credencialesInvalidas;
    }

    if (usuario.mfaEnabled) {
      if (!dto.mfaCode) {
        // 401 con bandera: el frontend debe pedir el código y reintentar.
        throw new UnauthorizedException({
          statusCode: 401,
          message: 'Código MFA requerido',
          mfaRequerido: true,
        });
      }
      const valido = this.verificarSegundoFactor(usuario, dto.mfaCode);
      if (!valido) {
        await this.registrarIntentoFallido(usuario, ip);
        throw new UnauthorizedException('Código MFA inválido');
      }
    }

    await this.usuarios.update(usuario.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    });

    logger.audit({ tipo: 'login_ok', usuarioId: usuario.id, email: usuario.email, ip });
    return this.emitirTokens(usuario);
  }

  /** Acepta código TOTP o, en su defecto, un código de respaldo de un solo uso. */
  private verificarSegundoFactor(usuario: User, codigo: string): boolean {
    if (usuario.mfaSecret && this.mfaService.verificarCodigo(codigo, usuario.mfaSecret, usuario.email)) {
      return true;
    }

    if (usuario.mfaBackupCodes?.length) {
      const restantes = this.mfaService.consumirCodigoRespaldo(
        codigo,
        usuario.mfaBackupCodes,
        usuario.email,
      );
      if (restantes) {
        // Fuego y olvido: si falla el guardado no se debe bloquear el login,
        // pero queda constancia para revisar el consumo del código.
        void this.usuarios
          .update(usuario.id, { mfaBackupCodes: restantes })
          .catch((error: unknown) =>
            logger.error('No se pudo invalidar el código de respaldo', error, 'AuthService'),
          );
        logger.audit({ tipo: 'mfa_codigo_respaldo_usado', usuarioId: usuario.id });
        return true;
      }
    }

    return false;
  }

  private async registrarIntentoFallido(usuario: User, ip?: string): Promise<void> {
    const intentos = usuario.failedLoginAttempts + 1;
    const bloquear = intentos >= MAX_INTENTOS;

    await this.usuarios.update(usuario.id, {
      failedLoginAttempts: intentos,
      lockedUntil: bloquear ? new Date(Date.now() + BLOQUEO_MINUTOS * 60_000) : null,
    });

    logger.audit({
      tipo: bloquear ? 'cuenta_bloqueada' : 'login_fallido',
      usuarioId: usuario.id,
      intentos,
      ip,
    });
  }

  // ============================================
  // Tokens
  // ============================================

  private async emitirTokens(usuario: User): Promise<ParTokens> {
    const expiresIn = this.segundosDeExpiracion();
    const jtiAccess = randomUUID();
    const jtiRefresh = randomUUID();

    const base = {
      sub: usuario.id,
      email: usuario.email,
      username: usuario.username,
      role: usuario.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ ...base, jti: jtiAccess, tipo: 'access' }),
      this.jwtService.signAsync(
        { ...base, jti: jtiRefresh, tipo: 'refresh' },
        {
          secret: this.secretoRefresh(),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
        },
      ),
    ]);

    return { accessToken, refreshToken, expiresIn, tokenType: 'Bearer' };
  }

  async refrescar(refreshToken: string): Promise<ParTokens> {
    let payload: PayloadJwt;
    try {
      payload = await this.jwtService.verifyAsync<PayloadJwt>(refreshToken, {
        secret: this.secretoRefresh(),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    if (payload.tipo !== 'refresh') {
      // Impide usar un access token como refresh para extender la sesión.
      throw new UnauthorizedException('Tipo de token incorrecto');
    }

    if (await this.estaRevocado(payload.jti)) {
      throw new UnauthorizedException('Token revocado');
    }

    const usuario = await this.usuarios.findOne({ where: { id: payload.sub } });
    if (!usuario || !usuario.isActive) {
      throw new UnauthorizedException('Usuario no disponible');
    }

    // Rotación: el refresh usado se revoca al emitir el nuevo par.
    await this.revocar(payload.jti, usuario.id, 'rotacion');
    return this.emitirTokens(usuario);
  }

  async logout(payload: PayloadJwt, refreshToken?: string): Promise<void> {
    await this.revocar(payload.jti, payload.sub, 'logout');

    if (refreshToken) {
      try {
        const refresh = await this.jwtService.verifyAsync<PayloadJwt>(refreshToken, {
          secret: this.secretoRefresh(),
        });
        await this.revocar(refresh.jti, payload.sub, 'logout');
        await this.keycloakService.cerrarSesion(refreshToken);
      } catch {
        // Un refresh token ya inválido no impide cerrar la sesión.
      }
    }

    logger.audit({ tipo: 'logout', usuarioId: payload.sub });
  }

  async estaRevocado(jti: string): Promise<boolean> {
    const registro = await this.listaNegra.findOne({ where: { jti } });
    return Boolean(registro);
  }

  private async revocar(jti: string, usuarioId: string, motivo: string): Promise<void> {
    const expiresAt = new Date(Date.now() + this.segundosDeExpiracion() * 1000);
    await this.listaNegra
      .createQueryBuilder()
      .insert()
      .values({ jti, usuarioId, motivo, expiresAt })
      .orIgnore()
      .execute();
  }

  /** Purga tokens ya expirados: la lista negra solo necesita los vigentes. */
  async purgarListaNegra(): Promise<number> {
    const { affected } = await this.listaNegra.delete({ expiresAt: LessThan(new Date()) });
    return affected ?? 0;
  }

  // ============================================
  // MFA
  // ============================================

  async iniciarAltaMfa(usuarioId: string) {
    const usuario = await this.obtenerUsuario(usuarioId);
    const alta = this.mfaService.generarAlta(usuario.email);

    // Se guarda el secreto pero MFA queda inactivo hasta confirmar un código
    // válido: si no, un alta a medias deja al usuario fuera de su cuenta.
    await this.usuarios.update(usuarioId, {
      mfaSecret: alta.secretCifrado,
      mfaBackupCodes: alta.backupCodesCifrados,
      mfaEnabled: false,
    });

    return {
      secret: alta.secret,
      otpauthUrl: alta.otpauthUrl,
      backupCodes: alta.backupCodes,
    };
  }

  async confirmarAltaMfa(usuarioId: string, codigo: string): Promise<void> {
    const usuario = await this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.mfaSecret')
      .where('u.id = :id', { id: usuarioId })
      .getOne();

    if (!usuario?.mfaSecret) {
      throw new UnauthorizedException('Primero debe iniciar el alta de MFA');
    }

    if (!this.mfaService.verificarCodigo(codigo, usuario.mfaSecret, usuario.email)) {
      throw new UnauthorizedException('Código MFA inválido');
    }

    await this.usuarios.update(usuarioId, { mfaEnabled: true });
    logger.audit({ tipo: 'mfa_activado', usuarioId });
  }

  async desactivarMfa(usuarioId: string): Promise<void> {
    await this.usuarios.update(usuarioId, {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
    });
    logger.audit({ tipo: 'mfa_desactivado', usuarioId });
  }

  // ============================================
  // Utilidades
  // ============================================

  async obtenerUsuario(id: string): Promise<User> {
    const usuario = await this.usuarios.findOne({ where: { id } });
    if (!usuario) throw new UnauthorizedException('Usuario no encontrado');
    return usuario;
  }

  /**
   * Localiza (o da de alta) al usuario local que corresponde a una identidad
   * de Keycloak. El realm es la fuente de verdad de la identidad; la tabla
   * local guarda el rol y la relación con el resto del dominio.
   */
  async sincronizarDesdeKeycloak(datos: {
    keycloakId: string;
    email: string;
    username: string;
    roles?: string[];
  }): Promise<User> {
    const existente = await this.usuarios.findOne({
      where: [{ keycloakId: datos.keycloakId }, { email: datos.email }],
    });

    if (existente) {
      if (!existente.keycloakId) {
        await this.usuarios.update(existente.id, { keycloakId: datos.keycloakId });
      }
      return existente;
    }

    const usuario = this.usuarios.create({
      email: datos.email,
      username: datos.username,
      // Sin contraseña local utilizable: la autenticación vive en el realm.
      passwordHash: this.encryption.hashPassword(randomUUID()),
      keycloakId: datos.keycloakId,
      role: this.mapearRol(datos.roles),
    });

    const guardado = await this.usuarios.save(usuario);
    logger.audit({ tipo: 'usuario_sincronizado_keycloak', usuarioId: guardado.id });
    return guardado;
  }

  private mapearRol(roles?: string[]): RolUsuario {
    const conocidos: RolUsuario[] = ['admin', 'manager', 'dispatcher', 'accountant', 'driver'];
    const encontrado = roles?.find((r) => conocidos.includes(r as RolUsuario));
    return (encontrado as RolUsuario) ?? 'dispatcher';
  }

  private secretoRefresh(): string {
    return this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      this.configService.get<string>('JWT_SECRET', 'dev-secret-min-32-chars-required'),
    );
  }

  /** `900s`, `15m`, `7d` -> segundos. */
  private segundosDeExpiracion(): number {
    const valor = this.configService.get<string>('JWT_EXPIRATION', '900s');
    const match = /^(\d+)([smhd]?)$/.exec(valor.trim());
    if (!match) return 900;

    const cantidad = Number(match[1]);
    const factor = { s: 1, m: 60, h: 3600, d: 86400, '': 1 }[match[2]] ?? 1;
    return cantidad * factor;
  }
}

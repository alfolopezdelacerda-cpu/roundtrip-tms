import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { randomBytes, timingSafeEqual } from 'crypto';
import { EncryptionService } from '../../../security/encryption/encryption.service';
import logger from '../../../common/logger';

export type AltaMfa = {
  /** Secreto en claro: se muestra UNA vez para dar de alta el autenticador. */
  secret: string;
  /** URI `otpauth://` para el código QR. */
  otpauthUrl: string;
  /** Códigos de respaldo en claro: se muestran UNA vez. */
  backupCodes: string[];
  /** Secreto y códigos ya cifrados, listos para persistir. */
  secretCifrado: string;
  backupCodesCifrados: string[];
};

/**
 * Segundo factor por TOTP (RFC 6238).
 *
 * El secreto nunca se guarda en claro: se cifra con AES-256-GCM antes de
 * tocar la base. Los códigos de respaldo se cifran uno a uno para poder
 * invalidar el usado sin regenerar el resto.
 */
@Injectable()
export class MfaService {
  private readonly emisor: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly encryption: EncryptionService,
  ) {
    this.emisor = this.configService.get<string>('MFA_ISSUER', 'Roundtrip TMS');

    // Ventana de 1 paso (±30 s) para absorber desfases de reloj sin abrir
    // una ventana de reutilización grande.
    authenticator.options = { window: 1 };
  }

  /** Genera secreto, URI de QR y códigos de respaldo para dar de alta MFA. */
  generarAlta(email: string): AltaMfa {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, this.emisor, secret);
    const backupCodes = Array.from({ length: 10 }, () =>
      randomBytes(5).toString('hex').toUpperCase(),
    );

    return {
      secret,
      otpauthUrl,
      backupCodes,
      secretCifrado: this.encryption.encrypt(secret, email),
      backupCodesCifrados: backupCodes.map((c) => this.encryption.encrypt(c, email)),
    };
  }

  /** Valida un código TOTP contra el secreto cifrado del usuario. */
  verificarCodigo(codigo: string, secretCifrado: string, email: string): boolean {
    try {
      const secret = this.encryption.decrypt(secretCifrado, email);
      return authenticator.verify({ token: codigo, secret });
    } catch (error) {
      logger.error('No se pudo verificar el código MFA', error, 'MfaService');
      // Un secreto ilegible es un fallo de configuración, no un código malo.
      throw new BadRequestException('MFA no disponible, contacte al administrador');
    }
  }

  /**
   * Consume un código de respaldo. Devuelve la lista restante si el código
   * era válido, o `null` si no lo era. El código consumido se elimina: los
   * de respaldo son de un solo uso.
   */
  consumirCodigoRespaldo(
    codigo: string,
    codigosCifrados: string[],
    email: string,
  ): string[] | null {
    const objetivo = codigo.trim().toUpperCase();

    for (let i = 0; i < codigosCifrados.length; i++) {
      let claro: string;
      try {
        claro = this.encryption.decrypt(codigosCifrados[i], email);
      } catch {
        continue;
      }
      if (this.comparacionSegura(claro, objetivo)) {
        return codigosCifrados.filter((_, idx) => idx !== i);
      }
    }

    return null;
  }

  /** Comparación en tiempo constante: evita distinguir códigos por latencia. */
  private comparacionSegura(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}

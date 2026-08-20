import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrivateKey, createSign, X509Certificate } from 'crypto';
import { readFileSync } from 'fs';
import logger from '../../common/logger';

/**
 * Sellado del CFDI con el Certificado de Sello Digital (CSD).
 *
 * El SAT entrega el CSD como un par `.cer` / `.key` en formato DER, con la
 * llave privada cifrada por contraseña. Aquí se cargan una sola vez al
 * arrancar: leer y descifrar la llave en cada timbrado sería tirar CPU y
 * multiplicar el tiempo que la llave pasa en claro en memoria.
 *
 * Si no hay CSD configurado, el servicio no se rompe: queda deshabilitado y
 * la emisión lo reporta. Es lo correcto en desarrollo —no todo el equipo
 * tiene por qué manejar la llave fiscal de la empresa.
 */
@Injectable()
export class SelladoService {
  private llavePrivada: ReturnType<typeof createPrivateKey> | null = null;
  private certificadoBase64 = '';
  private numeroCertificado = '';
  private rfcCertificado = '';
  private vigenciaHasta: Date | null = null;

  constructor(private readonly config: ConfigService) {
    this.cargar();
  }

  get disponible(): boolean {
    return this.llavePrivada !== null;
  }

  get certificado(): string {
    return this.certificadoBase64;
  }

  get noCertificado(): string {
    return this.numeroCertificado;
  }

  get rfcEmisor(): string {
    return this.rfcCertificado;
  }

  private cargar(): void {
    const rutaCer = this.config.get<string>('SAT_CSD_CER');
    const rutaKey = this.config.get<string>('SAT_CSD_KEY');
    const password = this.config.get<string>('SAT_CSD_PASSWORD');

    if (!rutaCer || !rutaKey || !password) {
      logger.warn(
        'CSD no configurado: la emisión de carta porte queda sin sellado',
        'SelladoService',
      );
      return;
    }

    try {
      const cer = readFileSync(rutaCer);
      const key = readFileSync(rutaKey);

      const certificado = new X509Certificate(cer);
      this.certificadoBase64 = cer.toString('base64');

      // El número de certificado es el serial, que el SAT codifica en hex
      // con cada byte representando un dígito ASCII del número real.
      this.numeroCertificado = Buffer.from(certificado.serialNumber, 'hex').toString();
      this.rfcCertificado = this.extraerRfc(certificado.subject);
      this.vigenciaHasta = new Date(certificado.validTo);

      this.llavePrivada = createPrivateKey({
        key,
        format: 'der',
        type: 'pkcs8',
        passphrase: password,
      });

      logger.log(
        `CSD cargado: ${this.numeroCertificado} (${this.rfcCertificado}), vigente hasta ${certificado.validTo}`,
        'SelladoService',
      );
    } catch (error) {
      // Nunca se registra la contraseña ni el contenido de la llave.
      logger.error('No se pudo cargar el CSD', error, 'SelladoService');
      this.llavePrivada = null;
    }
  }

  /** El RFC va en el subject del certificado, en el OID 2.5.4.45. */
  private extraerRfc(subject: string): string {
    const match = /(?:^|\n)(?:2\.5\.4\.45|x500UniqueIdentifier)=([A-ZÑ&0-9]+)/i.exec(
      subject,
    );
    return match?.[1]?.split(' ')[0] ?? '';
  }

  /**
   * Firma la cadena original con SHA256 + RSA y devuelve el sello en base64,
   * que es exactamente lo que el Anexo 20 pide para CFDI 4.0.
   */
  sellar(cadenaOriginal: string): string {
    if (!this.llavePrivada) {
      throw new ServiceUnavailableException(
        'No hay CSD configurado: no se puede sellar el comprobante',
      );
    }

    if (this.vigenciaHasta && this.vigenciaHasta < new Date()) {
      // Sellar con un certificado vencido produce comprobantes que el PAC
      // rechaza; es mejor detenerse aquí con un mensaje claro.
      throw new ServiceUnavailableException(
        `El CSD venció el ${this.vigenciaHasta.toISOString().slice(0, 10)}`,
      );
    }

    const firma = createSign('RSA-SHA256');
    firma.update(cadenaOriginal, 'utf8');
    firma.end();
    return firma.sign(this.llavePrivada).toString('base64');
  }
}

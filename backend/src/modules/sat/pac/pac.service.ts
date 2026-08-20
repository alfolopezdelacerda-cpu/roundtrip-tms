import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import logger from '../../../common/logger';

/**
 * Cliente del PAC (Proveedor Autorizado de Certificación).
 *
 * Timbrar es lo único que este sistema no puede hacer por sí mismo: el UUID
 * fiscal solo lo emite un PAC autorizado. Por eso la integración está detrás
 * de una interfaz con dos implementaciones:
 *
 * - `simulado`: devuelve un timbre falso, para desarrollo y pruebas. Los
 *   comprobantes que produce NO tienen validez fiscal.
 * - `http`: llama al PAC real por REST con las credenciales configuradas.
 *
 * El driver se elige con `SAT_PAC_DRIVER`. El valor por defecto es
 * `simulado`, de modo que un despliegue mal configurado produce timbres
 * evidentemente falsos en vez de fallar en silencio o, peor, timbrar de
 * verdad sin que nadie lo esperara.
 */

export type ResultadoTimbrado = {
  uuid: string;
  fechaTimbrado: string;
  selloSAT: string;
  noCertificadoSAT: string;
  xmlTimbrado: string;
  pac: string;
  /** true cuando el timbre proviene del driver simulado. */
  simulado: boolean;
};

export type ResultadoCancelacion = {
  cancelado: boolean;
  estatus: string;
  simulado: boolean;
};

@Injectable()
export class PacService {
  private readonly driver: string;
  private readonly url: string;
  private readonly usuario: string;
  private readonly password: string;
  private readonly nombre: string;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('SAT_PAC_DRIVER', 'simulado');
    this.url = this.config.get<string>('SAT_PAC_URL', '').replace(/\/$/, '');
    this.usuario = this.config.get<string>('SAT_PAC_USUARIO', '');
    this.password = this.config.get<string>('SAT_PAC_PASSWORD', '');
    this.nombre = this.config.get<string>('SAT_PAC_NOMBRE', this.driver);

    if (this.driver === 'simulado') {
      logger.warn(
        'PAC en modo simulado: los timbres NO tienen validez fiscal',
        'PacService',
      );
    }
  }

  get esSimulado(): boolean {
    return this.driver === 'simulado';
  }

  async timbrar(xml: string): Promise<ResultadoTimbrado> {
    if (this.driver === 'simulado') return this.timbrarSimulado(xml);
    return this.timbrarHttp(xml);
  }

  async cancelar(
    uuid: string,
    motivo: string,
    uuidSustitucion?: string,
  ): Promise<ResultadoCancelacion> {
    if (this.driver === 'simulado') {
      logger.warn(`Cancelación simulada de ${uuid}`, 'PacService');
      return { cancelado: true, estatus: 'simulado', simulado: true };
    }

    const respuesta = await this.peticion('/cancelar', {
      uuid,
      motivo,
      folioSustitucion: uuidSustitucion,
    });

    return {
      cancelado: Boolean(respuesta.cancelado ?? respuesta.Cancelado),
      estatus: String(respuesta.estatus ?? respuesta.Estatus ?? ''),
      simulado: false,
    };
  }

  /**
   * Timbre de desarrollo. Se marca con un UUID que empieza en `5IMU1AD0`
   * para que sea imposible confundirlo con uno real en una base de datos.
   */
  private timbrarSimulado(xml: string): ResultadoTimbrado {
    const uuid = `5IMU1AD0-${randomUUID().slice(9)}`.toUpperCase();
    const fechaTimbrado = new Date().toISOString().slice(0, 19);

    const timbre =
      `<cfdi:Complemento><tfd:TimbreFiscalDigital ` +
      `xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" ` +
      `UUID="${uuid}" FechaTimbrado="${fechaTimbrado}" ` +
      `RfcProvCertif="SIM010101000" SelloCFD="SIMULADO" NoCertificadoSAT="00000000000000000000" ` +
      `SelloSAT="SIMULADO"/></cfdi:Complemento>`;

    // Se inserta antes del cierre del comprobante, donde iría el timbre real.
    const xmlTimbrado = xml.replace(
      /<\/cfdi:Comprobante>\s*$/,
      `${timbre}</cfdi:Comprobante>`,
    );

    logger.audit({ tipo: 'timbrado_simulado', uuid });

    return {
      uuid,
      fechaTimbrado,
      selloSAT: 'SIMULADO',
      noCertificadoSAT: '00000000000000000000',
      xmlTimbrado,
      pac: 'simulado',
      simulado: true,
    };
  }

  private async timbrarHttp(xml: string): Promise<ResultadoTimbrado> {
    const respuesta = await this.peticion('/timbrar', { xml });

    const uuid = String(respuesta.uuid ?? respuesta.UUID ?? '');
    if (!uuid) {
      const mensaje = String(
        respuesta.mensaje ?? respuesta.Mensaje ?? 'El PAC no devolvió UUID',
      );
      throw new ServiceUnavailableException(`Timbrado rechazado: ${mensaje}`);
    }

    return {
      uuid,
      fechaTimbrado: String(respuesta.fechaTimbrado ?? respuesta.FechaTimbrado ?? ''),
      selloSAT: String(respuesta.selloSAT ?? respuesta.SelloSAT ?? ''),
      noCertificadoSAT: String(
        respuesta.noCertificadoSAT ?? respuesta.NoCertificadoSAT ?? '',
      ),
      xmlTimbrado: String(respuesta.xml ?? respuesta.Xml ?? ''),
      pac: this.nombre,
      simulado: false,
    };
  }

  private async peticion(
    ruta: string,
    cuerpo: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!this.url) {
      throw new ServiceUnavailableException(
        'SAT_PAC_URL no está configurada: no se puede timbrar',
      );
    }

    let respuesta: Response;
    try {
      respuesta = await fetch(`${this.url}${ruta}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Credenciales del PAC: nunca se escriben en el log.
          Authorization: `Basic ${Buffer.from(`${this.usuario}:${this.password}`).toString('base64')}`,
        },
        body: JSON.stringify(cuerpo),
      });
    } catch (error) {
      logger.error('No se pudo contactar al PAC', error, 'PacService');
      throw new ServiceUnavailableException('El PAC no está disponible');
    }

    const texto = await respuesta.text();
    if (!respuesta.ok) {
      logger.error(
        `PAC respondió ${respuesta.status}`,
        texto.slice(0, 500),
        'PacService',
      );
      throw new ServiceUnavailableException(
        `El PAC rechazó la petición (${respuesta.status})`,
      );
    }

    try {
      return JSON.parse(texto) as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException('El PAC devolvió una respuesta ilegible');
    }
  }
}

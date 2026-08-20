import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Servicio } from '../../../database/entities/servicio.entity';

/**
 * Comprobante fiscal de traslado (CFDI 4.0 + Complemento Carta Porte 3.1).
 *
 * El ciclo de vida es de una sola dirección: borrador → generado → timbrado →
 * cancelado. Un comprobante timbrado es inmutable: si algo está mal, se
 * cancela y se emite otro. Por eso el XML sellado y el UUID se guardan tal
 * cual los devolvió el PAC y nunca se recalculan.
 */
export type EstadoCartaPorte =
  | 'borrador'
  | 'generado'
  | 'timbrado'
  | 'error'
  | 'cancelado';

export const ESTADOS_CARTA_PORTE: EstadoCartaPorte[] = [
  'borrador',
  'generado',
  'timbrado',
  'error',
  'cancelado',
];

@Entity('cartas_porte')
export class CartaPorte {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Un servicio tiene una sola carta porte vigente. */
  @OneToOne(() => Servicio, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'servicio_id' })
  servicio: Servicio;

  @Index('idx_carta_porte_folio')
  @Column({ type: 'varchar', length: 50 })
  folio: string;

  @Column({ type: 'varchar', length: 25, default: 'A' })
  serie: string;

  @Index('idx_carta_porte_estado')
  @Column({ type: 'enum', enum: ESTADOS_CARTA_PORTE, default: 'borrador' })
  estado: EstadoCartaPorte;

  /** IdCCP: identificador propio del complemento, formato CCC + UUID. */
  @Index('idx_carta_porte_idccp', { unique: true })
  @Column({ name: 'id_ccp', type: 'varchar', length: 40 })
  idCCP: string;

  // ---- Documento ----

  @Column({ name: 'xml_sin_sellar', type: 'text', nullable: true })
  xmlSinSellar: string | null;

  /**
   * Cadena original del comprobante. Se guarda porque es lo que se firmó:
   * ante una aclaración, es la evidencia de qué se selló exactamente.
   */
  @Column({ name: 'cadena_original', type: 'text', nullable: true })
  cadenaOriginal: string | null;

  @Column({ type: 'text', nullable: true })
  sello: string | null;

  @Column({ name: 'no_certificado', type: 'varchar', length: 20, nullable: true })
  noCertificado: string | null;

  /** XML tal como lo devolvió el PAC, ya con el TimbreFiscalDigital. */
  @Column({ name: 'xml_timbrado', type: 'text', nullable: true })
  xmlTimbrado: string | null;

  // ---- Timbre ----

  @Index('idx_carta_porte_uuid', { unique: true })
  @Column({ name: 'uuid_fiscal', type: 'varchar', length: 36, nullable: true })
  uuidFiscal: string | null;

  @Column({ name: 'fecha_timbrado', type: 'timestamp', nullable: true })
  fechaTimbrado: Date | null;

  @Column({ name: 'pac_nombre', type: 'varchar', length: 100, nullable: true })
  pacNombre: string | null;

  /** Mensaje del PAC cuando el timbrado falla: es lo que se corrige. */
  @Column({ name: 'ultimo_error', type: 'text', nullable: true })
  ultimoError: string | null;

  // ---- Cancelación ----

  @Column({ name: 'motivo_cancelacion', type: 'varchar', length: 10, nullable: true })
  motivoCancelacion: string | null;

  @Column({ name: 'uuid_sustitucion', type: 'varchar', length: 36, nullable: true })
  uuidSustitucion: string | null;

  @Column({ name: 'fecha_cancelacion', type: 'timestamp', nullable: true })
  fechaCancelacion: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

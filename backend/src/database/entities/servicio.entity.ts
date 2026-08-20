import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../modules/auth/entities/user.entity';
import { Conductor, Vehiculo } from './transportes.entities';
import {
  Cliente,
  Puerto,
  TipoMercancia,
  TipoNegocio,
  TipoUnidad,
} from './catalogos.entities';

/**
 * Servicio de transporte: la unidad de trabajo del TMS.
 *
 * Sustituye a `solicitudes_transportes` del esquema original. Los estados
 * siguen al detalle operativo que usa la aplicación (ida, destino, vuelta)
 * en vez del genérico `en_ruta`, porque monitoreo necesita distinguir el
 * tramo, y en round trip la diferencia entre ida y vuelta es media operación.
 */

export type Asignacion = 'TDC' | 'FWD';
export type Modalidad = 'OW' | 'RT';
export type Temperatura = 'RF' | 'SECO';

export type EstadoServicio =
  | 'programado'
  | 'en_ruta_ida'
  | 'en_destino'
  | 'en_ruta_vuelta'
  | 'completado'
  | 'cancelado';

export type EstadoCobro = 'pendiente' | 'facturado' | 'cobrado' | 'vencido';
export type EstadoPago = 'pendiente' | 'autorizado' | 'pagado';
export type EstadoLiquidacionServicio = 'pendiente' | 'liquidado';

export const ESTADOS_SERVICIO: EstadoServicio[] = [
  'programado',
  'en_ruta_ida',
  'en_destino',
  'en_ruta_vuelta',
  'completado',
  'cancelado',
];

export const ESTADOS_COBRO: EstadoCobro[] = [
  'pendiente',
  'facturado',
  'cobrado',
  'vencido',
];

export const ESTADOS_PAGO: EstadoPago[] = ['pendiente', 'autorizado', 'pagado'];

/** Estados en los que el servicio sigue vivo en la operación. */
export const SERVICIO_ACTIVO: EstadoServicio[] = [
  'programado',
  'en_ruta_ida',
  'en_destino',
  'en_ruta_vuelta',
];

@Entity('servicios')
@Index('idx_servicios_asignacion_estado', ['asignacion', 'estado'])
export class Servicio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_servicios_folio', { unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  folio: string;

  /** Folio de carta porte, asignado automáticamente al crear el servicio. */
  @Index('idx_servicios_carta_porte', { unique: true })
  @Column({ name: 'carta_porte', type: 'varchar', length: 50, unique: true })
  cartaPorte: string;

  @ManyToOne(() => Cliente, { nullable: false, eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;

  @Column({ type: 'varchar', length: 255 })
  origen: string;

  @Column({ type: 'varchar', length: 255 })
  destino: string;

  @ManyToOne(() => Puerto, { nullable: false, eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'puerto_id' })
  puerto: Puerto;

  @Index('idx_servicios_cita_carga')
  @Column({ name: 'cita_carga', type: 'timestamp' })
  citaCarga: Date;

  @Column({ name: 'cita_descarga', type: 'timestamp' })
  citaDescarga: Date;

  @Column({ type: 'enum', enum: ['TDC', 'FWD'] })
  asignacion: Asignacion;

  /** Solo TDC. */
  @ManyToOne(() => Vehiculo, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehiculo_id' })
  vehiculo: Vehiculo | null;

  /** Solo TDC. */
  @ManyToOne(() => Conductor, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'conductor_id' })
  conductor: Conductor | null;

  /** Solo FWD. Vive en forwarding_db, por eso es un id suelto sin FK. */
  @Column({ name: 'proveedor_id', type: 'uuid', nullable: true })
  proveedorId: string | null;

  @ManyToOne(() => TipoNegocio, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tipo_negocio_id' })
  tipoNegocio: TipoNegocio | null;

  @Column({ type: 'enum', enum: ['RF', 'SECO'], default: 'SECO' })
  temperatura: Temperatura;

  @Column({ type: 'enum', enum: ['OW', 'RT'], default: 'RT' })
  modalidad: Modalidad;

  @ManyToOne(() => TipoUnidad, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tipo_unidad_id' })
  tipoUnidad: TipoUnidad | null;

  @ManyToOne(() => TipoMercancia, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tipo_mercancia_id' })
  tipoMercancia: TipoMercancia | null;

  @Column({ type: 'varchar', length: 50, default: '' })
  contenedor1: string;

  /** Solo si el tipo de unidad es full. */
  @Column({ type: 'varchar', length: 50, default: '' })
  contenedor2: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  booking: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  po: string;

  @Index('idx_servicios_estado')
  @Column({ type: 'enum', enum: ESTADOS_SERVICIO, default: 'programado' })
  estado: EstadoServicio;

  @Column({ type: 'int', default: 0 })
  km: number;

  /** Lo que se le cobra al cliente (MXN). */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  tarifa: string;

  /** Costo de ejecución: al proveedor en FWD, operativo en TDC. */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  costo: string;

  // ---- Cobro ----
  @Index('idx_servicios_cobro')
  @Column({ name: 'cobro_estado', type: 'enum', enum: ESTADOS_COBRO, default: 'pendiente' })
  cobroEstado: EstadoCobro;

  @Column({ name: 'cobro_factura', type: 'varchar', length: 50, nullable: true })
  cobroFactura: string | null;

  @Column({ name: 'cobro_fecha_factura', type: 'date', nullable: true })
  cobroFechaFactura: string | null;

  @Column({ name: 'cobro_dias_credito', type: 'int', default: 30 })
  cobroDiasCredito: number;

  // ---- Pago ----
  @Index('idx_servicios_pago')
  @Column({ name: 'pago_estado', type: 'enum', enum: ESTADOS_PAGO, default: 'pendiente' })
  pagoEstado: EstadoPago;

  @Column({ name: 'pago_referencia', type: 'varchar', length: 100, nullable: true })
  pagoReferencia: string | null;

  @Column({ name: 'pago_fecha', type: 'date', nullable: true })
  pagoFecha: string | null;

  // ---- Liquidación ----
  @Column({
    name: 'liquidacion_estado',
    type: 'enum',
    enum: ['pendiente', 'liquidado'],
    default: 'pendiente',
  })
  liquidacionEstado: EstadoLiquidacionServicio;

  @Column({ name: 'liquidacion_fecha', type: 'date', nullable: true })
  liquidacionFecha: string | null;

  // ---- Monitoreo ----
  @Column({ name: 'monitoreo_avance', type: 'int', default: 0 })
  monitoreoAvance: number;

  @Column({ name: 'monitoreo_ubicacion', type: 'varchar', length: 255, default: '' })
  monitoreoUbicacion: string;

  @Column({ name: 'monitoreo_ultimo_evento', type: 'varchar', length: 500, default: '' })
  monitoreoUltimoEvento: string;

  @Column({ name: 'monitoreo_actualizado', type: 'timestamp', nullable: true })
  monitoreoActualizado: Date | null;

  // ---- Datos exigidos por el complemento Carta Porte ----

  /** Código postal de origen y destino: el CCP los pide en cada ubicación. */
  @Column({ name: 'cp_origen', type: 'varchar', length: 5, nullable: true })
  cpOrigen: string | null;

  @Column({ name: 'cp_destino', type: 'varchar', length: 5, nullable: true })
  cpDestino: string | null;

  /** Peso bruto total de la mercancía y su unidad (c_ClaveUnidadPeso). */
  @Column({ name: 'peso_bruto_total', type: 'decimal', precision: 12, scale: 3, default: 0 })
  pesoBrutoTotal: string;

  @Column({ name: 'unidad_peso', type: 'varchar', length: 5, default: 'KGM' })
  unidadPeso: string;

  /** c_ClaveProdServCP de la mercancía transportada. */
  @Column({ name: 'clave_prod_serv_cp', type: 'varchar', length: 10, nullable: true })
  claveProdServCP: string | null;

  @Column({ type: 'text', nullable: true })
  notas: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'creado_por_id' })
  creadoPor: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

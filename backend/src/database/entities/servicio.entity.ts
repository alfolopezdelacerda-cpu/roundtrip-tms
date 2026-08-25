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
  Ruta,
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
  | 'por_asignar'
  | 'programado'
  | 'en_ruta_ida'
  | 'en_destino'
  | 'en_ruta_vuelta'
  | 'completado'
  | 'cancelado';

export type EstadoCobro = 'pendiente' | 'facturado' | 'cobrado' | 'vencido';
export type EstadoPago = 'pendiente' | 'autorizado' | 'pagado';
export type EstadoLiquidacionServicio = 'pendiente' | 'liquidado';

/**
 * `por_asignar` es el estado de alta: el servicio existe pero todavía no
 * tiene unidad+operador (TDC) o proveedor (FWD). Solo al "Programar Servicio"
 * desde Asignación TDC/FWD pasa a `programado`, que es cuando aparece en
 * Monitoreo.
 */
export const ESTADOS_SERVICIO: EstadoServicio[] = [
  'por_asignar',
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

  /**
   * Solo TDC. Al elegirla en Asignación TDC, `km` y `casetasProyectadas` se
   * copian de aquí como foto del momento: si la ruta cambia sus proyecciones
   * después, los servicios ya asignados no se mueven solos.
   */
  @ManyToOne(() => Ruta, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ruta_id' })
  ruta: Ruta | null;

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

  /** Proyección de casetas copiada de la ruta al momento de asignar (TDC). */
  @Column({ name: 'casetas_proyectadas', type: 'decimal', precision: 12, scale: 2, default: 0 })
  casetasProyectadas: string;

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

  /**
   * Datos manuales que se capturan cuando el servicio cae en la ventana de
   * Monitoreo. En FWD el operador y la unidad reales son del proveedor y no
   * existen en nuestros catálogos; en TDC pueden diferir de lo asignado si al
   * final salió otro operador u otra unidad.
   */
  @Column({ name: 'monitoreo_operador_manual', type: 'varchar', length: 255, default: '' })
  monitoreoOperadorManual: string;

  @Column({
    name: 'monitoreo_medio_comunicacion',
    type: 'varchar',
    length: 255,
    default: '',
  })
  monitoreoMedioComunicacion: string;

  @Column({ name: 'monitoreo_unidad_manual', type: 'varchar', length: 100, default: '' })
  monitoreoUnidadManual: string;

  @Column({ name: 'monitoreo_placa_manual', type: 'varchar', length: 20, default: '' })
  monitoreoPlacaManual: string;

  @Column({ name: 'monitoreo_observaciones', type: 'text', default: '' })
  monitoreoObservaciones: string;

  /** Cuenta espejo del rastreo GPS del proveedor: solo aplica a FWD. */
  @Column({ name: 'monitoreo_cuenta_espejo', type: 'varchar', length: 100, default: '' })
  monitoreoCuentaEspejo: string;

  @Column({ name: 'monitoreo_referencia', type: 'varchar', length: 100, default: '' })
  monitoreoReferencia: string;

  /**
   * Bitácora de hitos del tramo, capturados a mano según van ocurriendo.
   * Ninguno se infiere de `estado`: tráfico los anota conforme suceden.
   */
  @Column({ name: 'monitoreo_salida_patio', type: 'timestamp', nullable: true })
  monitoreoSalidaPatio: Date | null;

  @Column({ name: 'monitoreo_arribo_carga', type: 'timestamp', nullable: true })
  monitoreoArriboCarga: Date | null;

  @Column({ name: 'monitoreo_ingreso_cargar', type: 'timestamp', nullable: true })
  monitoreoIngresoCargar: Date | null;

  @Column({ name: 'monitoreo_inicio_ruta', type: 'timestamp', nullable: true })
  monitoreoInicioRuta: Date | null;

  @Column({ name: 'monitoreo_arribo_destino', type: 'timestamp', nullable: true })
  monitoreoArriboDestino: Date | null;

  @Column({ name: 'monitoreo_ingreso_descarga', type: 'timestamp', nullable: true })
  monitoreoIngresoDescarga: Date | null;

  @Column({ name: 'monitoreo_servicio_finalizado', type: 'timestamp', nullable: true })
  monitoreoServicioFinalizado: Date | null;

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

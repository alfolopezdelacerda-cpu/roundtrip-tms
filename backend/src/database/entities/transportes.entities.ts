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

/**
 * Entidades de la BD de transportes (docs/DATABASE-SCHEMA.md).
 *
 * Los campos `*_encrypted` guardan base64 de AES-256-GCM producido por
 * `EncryptionService`; por eso son `varchar(500)` y nunca se indexan por
 * contenido: un ciphertext con IV aleatorio es distinto en cada escritura.
 */

export type EstadoConductor = 'activo' | 'inactivo' | 'suspendido' | 'baja';
export type TipoVehiculo = 'full_trailer' | 'sencillo' | 'rabon' | 'pickup';
export type EstadoVehiculo = 'operativo' | 'mantenimiento' | 'fuera_servicio' | 'vendido';
export type TipoCarga = 'general' | 'perecedero' | 'peligroso' | 'fragil';
export type EstadoLiquidacion = 'borrador' | 'revisada' | 'pagada' | 'cancelada';
export type TipoGasto = 'diesel' | 'peajes' | 'mantenimiento' | 'reparacion' | 'otros';

@Entity('conductores')
export class Conductor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nombre_completo', type: 'varchar', length: 255 })
  nombreCompleto: string;

  @Column({ name: 'email_encrypted', type: 'varchar', length: 500, nullable: true })
  emailEncrypted: string | null;

  @Column({ name: 'telefono_encrypted', type: 'varchar', length: 500, nullable: true })
  telefonoEncrypted: string | null;

  @Column({ name: 'rfc_encrypted', type: 'varchar', length: 500, nullable: true })
  rfcEncrypted: string | null;

  @Column({ name: 'curp_encrypted', type: 'varchar', length: 500, nullable: true })
  curpEncrypted: string | null;

  @Column({ name: 'licencia_numero', type: 'varchar', length: 100, nullable: true })
  licenciaNumero: string | null;

  @Column({ name: 'licencia_vencimiento', type: 'date', nullable: true })
  licenciaVencimiento: string | null;

  @Column({ name: 'cuenta_bancaria_encrypted', type: 'varchar', length: 500, nullable: true })
  cuentaBancariaEncrypted: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  banco: string | null;

  @Column({ name: 'clabe_encrypted', type: 'varchar', length: 500, nullable: true })
  clabeEncrypted: string | null;

  @Index('idx_conductores_estado')
  @Column({
    type: 'enum',
    enum: ['activo', 'inactivo', 'suspendido', 'baja'],
    default: 'activo',
  })
  estado: EstadoConductor;

  @Column({ name: 'fecha_contratacion', type: 'date', nullable: true })
  fechaContratacion: string | null;

  @Column({ name: 'fecha_baja', type: 'date', nullable: true })
  fechaBaja: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by_id' })
  updatedBy: User | null;
}

@Entity('vehiculos')
export class Vehiculo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Número económico: como se le llama a la unidad en la operación. */
  @Index('idx_vehiculos_economico', { unique: true })
  @Column({ type: 'varchar', length: 30, unique: true })
  economico: string;

  @Index('idx_vehiculos_placa', { unique: true })
  @Column({ type: 'varchar', length: 20, unique: true })
  placa: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Index('idx_vehiculos_tipo')
  @Column({ type: 'enum', enum: ['full_trailer', 'sencillo', 'rabon', 'pickup'] })
  tipo: TipoVehiculo;

  @Column({ type: 'varchar', length: 100, nullable: true })
  marca: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  modelo: string | null;

  @Column({ type: 'int', nullable: true })
  anio: number | null;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  vin: string | null;

  @Column({ name: 'capacidad_toneladas', type: 'decimal', precision: 10, scale: 2, nullable: true })
  capacidadToneladas: string | null;

  @Column({ name: 'capacidad_volumen_m3', type: 'decimal', precision: 10, scale: 2, nullable: true })
  capacidadVolumenM3: string | null;

  @Column({ name: 'poliza_seguro', type: 'varchar', length: 100, nullable: true })
  polizaSeguro: string | null;

  @Column({ name: 'vencimiento_seguro', type: 'date', nullable: true })
  vencimientoSeguro: string | null;

  @Column({ name: 'tenencia_pagada', type: 'boolean', default: false })
  tenenciaPagada: boolean;

  @Column({ name: 'verificacion_vigente', type: 'boolean', default: false })
  verificacionVigente: boolean;

  @Column({ name: 'gps_imei', type: 'varchar', length: 50, nullable: true })
  gpsImei: string | null;

  @Column({ name: 'gps_proveedor', type: 'varchar', length: 50, nullable: true })
  gpsProveedor: string | null;

  @Column({ name: 'valor_adquisicion', type: 'decimal', precision: 15, scale: 2, nullable: true })
  valorAdquisicion: string | null;

  @Column({ name: 'fecha_adquisicion', type: 'date', nullable: true })
  fechaAdquisicion: string | null;

  @Column({ name: 'depreciation_monthly', type: 'decimal', precision: 15, scale: 2, nullable: true })
  depreciacionMensual: string | null;

  @Index('idx_vehiculos_estado')
  @Column({
    type: 'enum',
    enum: ['operativo', 'mantenimiento', 'fuera_servicio', 'vendido'],
    default: 'operativo',
  })
  estado: EstadoVehiculo;

  @Column({ name: 'fecha_baja', type: 'date', nullable: true })
  fechaBaja: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

// `solicitudes_transportes` quedó sustituida por la entidad `Servicio`
// (servicio.entity.ts), que es la que usa la aplicación: agrega puerto,
// citas con hora, modalidad, contenedores y el cierre financiero.

@Entity('liquidaciones')
@Index('idx_liquidaciones_periodo', ['periodoInicio', 'periodoFin'])
export class Liquidacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_liquidaciones_conductor')
  @ManyToOne(() => Conductor, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'conductor_id' })
  conductor: Conductor;

  @Column({ name: 'periodo_inicio', type: 'date' })
  periodoInicio: string;

  @Column({ name: 'periodo_fin', type: 'date' })
  periodoFin: string;

  @Column({ name: 'total_km', type: 'int', default: 0 })
  totalKm: number;

  @Column({ name: 'tarifa_por_km', type: 'decimal', precision: 10, scale: 2, default: 0 })
  tarifaPorKm: string;

  @Column({ name: 'subtotal_transporte', type: 'decimal', precision: 15, scale: 2, default: 0 })
  subtotalTransporte: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  bonos: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  descuentos: string;

  @Column({ name: 'avances_efectivo', type: 'decimal', precision: 15, scale: 2, default: 0 })
  avancesEfectivo: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  multas: string;

  @Column({ name: 'total_neto', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalNeto: string;

  @Index('idx_liquidaciones_estado')
  @Column({
    type: 'enum',
    enum: ['borrador', 'revisada', 'pagada', 'cancelada'],
    default: 'borrador',
  })
  estado: EstadoLiquidacion;

  @Column({ name: 'fecha_pago', type: 'date', nullable: true })
  fechaPago: string | null;

  @Column({ name: 'numero_comprobante_pago', type: 'varchar', length: 50, nullable: true })
  numeroComprobantePago: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'creada_por_id' })
  creadaPor: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'revisada_por_id' })
  revisadaPor: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('gastos_operativos')
export class GastoOperativo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_gastos_tipo')
  @Column({
    type: 'enum',
    enum: ['diesel', 'peajes', 'mantenimiento', 'reparacion', 'otros'],
  })
  tipo: TipoGasto;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  monto: string;

  @Column({ type: 'date' })
  fecha: string;

  @Index('idx_gastos_conductor')
  @ManyToOne(() => Conductor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'conductor_id' })
  conductor: Conductor | null;

  @Index('idx_gastos_vehiculo')
  @ManyToOne(() => Vehiculo, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehiculo_id' })
  vehiculo: Vehiculo | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'registrado_por_id' })
  registradoPor: User | null;

  @Column({ name: 'requiere_aprobacion', type: 'boolean', default: false })
  requiereAprobacion: boolean;

  @Column({ type: 'boolean', default: false })
  aprobado: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'aprobado_por_id' })
  aprobadoPor: User | null;

  @Column({ name: 'comprobante_uuid', type: 'varchar', length: 100, nullable: true })
  comprobanteUuid: string | null;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** Entidades de la conexión `transportes` (la conexión por defecto). */
export const ENTIDADES_TRANSPORTES = [
  Conductor,
  Vehiculo,
  Liquidacion,
  GastoOperativo,
];

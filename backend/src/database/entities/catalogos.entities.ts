import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Catálogos que alimentan el alta de servicios.
 *
 * Todos llevan `activo` en vez de borrarse: un catálogo dado de baja debe
 * seguir resolviendo el nombre de los servicios históricos que lo usaron.
 * El borrado real solo procede cuando nadie lo referencia, y de eso se
 * encarga `CatalogosService`.
 */
abstract class Base {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('clientes')
export class Cliente extends Base {
  /** RFC cifrado con AES-256-GCM: es dato fiscal identificable. */
  @Column({ name: 'rfc_encrypted', type: 'varchar', length: 500, nullable: true })
  rfcEncrypted: string | null;

  /** Régimen fiscal del receptor (c_RegimenFiscal). Obligatorio en CFDI 4.0. */
  @Column({ name: 'regimen_fiscal', type: 'varchar', length: 5, nullable: true })
  regimenFiscal: string | null;

  /** Código postal del domicilio fiscal del receptor. Obligatorio en 4.0. */
  @Column({ name: 'codigo_postal', type: 'varchar', length: 5, nullable: true })
  codigoPostal: string | null;

  /** Días de crédito por defecto al dar de alta un servicio. */
  @Column({ name: 'dias_credito', type: 'int', default: 30 })
  diasCredito: number;

  @Index('idx_clientes_activo')
  @Column({ type: 'boolean', default: true })
  declare activo: boolean;
}

@Entity('puertos')
export class Puerto extends Base {}

@Entity('tipos_negocio')
export class TipoNegocio extends Base {}

@Entity('tipos_unidad')
export class TipoUnidad extends Base {
  /** Si es full, el servicio admite un segundo contenedor. */
  @Column({ type: 'boolean', default: false })
  full: boolean;
}

@Entity('tipos_mercancia')
export class TipoMercancia extends Base {}

/**
 * Proveedores que ejecutan los servicios FWD.
 *
 * Provisional: según docs/DATABASE-SCHEMA.md estos viven en `forwarding_db`.
 * Mientras esa base no tenga entidades, se guardan aquí para que la
 * asignación FWD funcione; por eso `Servicio.proveedorId` sigue siendo un
 * UUID suelto sin llave foránea, y mudarlos después no rompe nada.
 */
@Entity('proveedores')
export class Proveedor extends Base {
  @Column({
    type: 'enum',
    enum: ['transportista', 'agente_aduanal', 'almacen', 'seguros'],
    default: 'transportista',
  })
  tipo: string;

  @Column({ name: 'dias_pago', type: 'int', default: 30 })
  diasPago: number;

  @Column({ name: 'contacto_encrypted', type: 'varchar', length: 500, nullable: true })
  contactoEncrypted: string | null;
}

/**
 * Rutas frecuentes con su código y sus proyecciones de kilómetros y
 * casetas. Es lo que Asignación TDC usa para autocompletar esos dos campos
 * al elegir un "Código de Ruta": nadie los captura a mano por servicio.
 */
@Entity('rutas')
export class Ruta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_rutas_codigo', { unique: true })
  @Column({ type: 'varchar', length: 30, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 255 })
  origen: string;

  @Column({ type: 'varchar', length: 255 })
  destino: string;

  @Column({ name: 'km_proyectados', type: 'int', default: 0 })
  kmProyectados: number;

  @Column({ name: 'casetas_proyectadas', type: 'decimal', precision: 12, scale: 2, default: 0 })
  casetasProyectadas: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export const ENTIDADES_CATALOGOS = [
  Cliente,
  Proveedor,
  Puerto,
  TipoNegocio,
  TipoUnidad,
  TipoMercancia,
  Ruta,
];

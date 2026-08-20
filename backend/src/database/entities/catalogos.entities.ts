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

export const ENTIDADES_CATALOGOS = [
  Cliente,
  Puerto,
  TipoNegocio,
  TipoUnidad,
  TipoMercancia,
];

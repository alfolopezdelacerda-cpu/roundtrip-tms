import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conductor } from './transportes.entities';
import { TipoIncidencia } from './catalogos.entities';
import { Servicio } from './servicio.entity';
import { User } from '../../modules/auth/entities/user.entity';

/**
 * Incidencia reportada a un operador desde Monitoreo (desvío de ruta,
 * estadía no autorizada, etc.). El operador es de catálogo en TDC
 * (`conductor`); en FWD es un nombre manual (`operadorNombre`), porque el
 * operador real es del proveedor y no vive en ningún catálogo propio.
 */
@Entity('incidencias')
export class Incidencia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_incidencias_conductor')
  @ManyToOne(() => Conductor, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'conductor_id' })
  conductor: Conductor | null;

  /** Nombre del operador cuando no viene de catálogo (asignación FWD). */
  @Column({ name: 'operador_nombre', type: 'varchar', length: 255, nullable: true })
  operadorNombre: string | null;

  @ManyToOne(() => TipoIncidencia, { nullable: false, eager: true })
  @JoinColumn({ name: 'tipo_id' })
  tipo: TipoIncidencia;

  @Index('idx_incidencias_servicio')
  @ManyToOne(() => Servicio, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'servicio_id' })
  servicio: Servicio | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  descripcion: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'creado_por' })
  creadoPor: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

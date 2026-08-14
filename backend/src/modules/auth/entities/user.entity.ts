import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type RolUsuario = 'admin' | 'dispatcher' | 'driver' | 'accountant' | 'manager';

export const ROLES: RolUsuario[] = [
  'admin',
  'dispatcher',
  'driver',
  'accountant',
  'manager',
];

/**
 * Usuarios del sistema (BD transportes). Corresponde a la tabla `users` de
 * docs/DATABASE-SCHEMA.md.
 *
 * `passwordHash` guarda `salt:hash` de PBKDF2-SHA512 (ver
 * `EncryptionService.hashPassword`), nunca la contraseña.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_users_email', { unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  username: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName: string | null;

  @Column({ type: 'enum', enum: ROLES, default: 'dispatcher' })
  role: RolUsuario;

  @Index('idx_users_keycloak_id')
  @Column({ name: 'keycloak_id', type: 'varchar', length: 255, nullable: true })
  keycloakId: string | null;

  @Column({ name: 'mfa_enabled', type: 'boolean', default: false })
  mfaEnabled: boolean;

  /** Secreto TOTP, cifrado con AES-256-GCM antes de persistirse. */
  @Column({ name: 'mfa_secret', type: 'varchar', length: 500, nullable: true, select: false })
  mfaSecret: string | null;

  /** Códigos de respaldo, cifrados uno a uno. */
  @Column({ name: 'mfa_backup_codes', type: 'text', array: true, nullable: true, select: false })
  mfaBackupCodes: string[] | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Intentos fallidos consecutivos; se reinicia al autenticar con éxito. */
  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ name: 'locked_until', type: 'timestamp', nullable: true })
  lockedUntil: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @Column({ name: 'deleted_by_id', type: 'uuid', nullable: true })
  deletedById: string | null;
}

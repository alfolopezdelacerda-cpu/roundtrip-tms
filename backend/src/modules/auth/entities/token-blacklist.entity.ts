import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Tokens revocados (logout, cambio de contraseña, expulsión de sesión).
 *
 * Se guarda el `jti` del JWT, no el token completo: basta para revocar y
 * evita almacenar credenciales utilizables. `expiresAt` permite purgar la
 * tabla —un token ya expirado no necesita seguir en la lista negra.
 */
@Entity('token_blacklist')
export class TokenBlacklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_token_blacklist_jti', { unique: true })
  @Column({ type: 'varchar', length: 64, unique: true })
  jti: string;

  @Index('idx_token_blacklist_usuario')
  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId: string | null;

  @Column({ type: 'varchar', length: 100, default: 'logout' })
  motivo: string;

  @Index('idx_token_blacklist_expira')
  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

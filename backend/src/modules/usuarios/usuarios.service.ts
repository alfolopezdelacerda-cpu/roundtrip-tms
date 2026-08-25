import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { EncryptionService } from '../../security/encryption/encryption.service';
import logger from '../../common/logger';
import type {
  ActualizarUsuarioDto,
  CambiarPasswordDto,
  CrearUsuarioDto,
} from './dto/usuario.dto';

/**
 * Administración de usuarios y permisos.
 *
 * Vive aparte de `AuthModule` a propósito: `auth` resuelve la sesión del
 * propio usuario, esto es el panel del administrador sobre los demás. El
 * permiso efectivo es el rol, que `RolesGuard` evalúa en cada endpoint.
 */
@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(User) private readonly usuarios: Repository<User>,
    private readonly encryption: EncryptionService,
  ) {}

  async listar() {
    const registros = await this.usuarios.find({ order: { email: 'ASC' } });
    return registros.map((u) => this.presentar(u));
  }

  async crear(dto: CrearUsuarioDto, creadoPorId?: string) {
    await this.exigirDisponible(dto.email, dto.username);

    const usuario = this.usuarios.create({
      email: dto.email,
      username: dto.username,
      passwordHash: this.encryption.hashPassword(dto.password),
      firstName: dto.firstName ?? null,
      lastName: dto.lastName ?? null,
      role: dto.role,
      createdById: creadoPorId ?? null,
    });

    const guardado = await this.usuarios.save(usuario);
    logger.audit({
      tipo: 'usuario_creado_admin',
      usuarioId: guardado.id,
      email: guardado.email,
      rol: guardado.role,
      creadoPorId,
    });
    return this.presentar(guardado);
  }

  async actualizar(id: string, dto: ActualizarUsuarioDto, actorId: string) {
    const usuario = await this.exigir(id);

    // Un administrador que se quita a sí mismo el rol o se desactiva se deja
    // fuera del panel y ya no puede revertirlo: se bloquea antes de guardar.
    if (id === actorId) {
      if (dto.role && dto.role !== usuario.role) {
        throw new BadRequestException('No puede cambiar su propio rol');
      }
      if (dto.isActive === false) {
        throw new BadRequestException('No puede desactivar su propia cuenta');
      }
    }

    if (dto.email || dto.username) {
      await this.exigirDisponible(dto.email, dto.username, id);
    }

    if (usuario.role === 'admin' && (dto.role !== undefined || dto.isActive === false)) {
      await this.exigirOtroAdminActivo(id);
    }

    if (dto.email !== undefined) usuario.email = dto.email;
    if (dto.username !== undefined) usuario.username = dto.username;
    if (dto.role !== undefined) usuario.role = dto.role;
    if (dto.firstName !== undefined) usuario.firstName = dto.firstName;
    if (dto.lastName !== undefined) usuario.lastName = dto.lastName;
    if (dto.isActive !== undefined) usuario.isActive = dto.isActive;

    const guardado = await this.usuarios.save(usuario);
    logger.audit({ tipo: 'usuario_actualizado', usuarioId: id, actorId });
    return this.presentar(guardado);
  }

  async cambiarPassword(id: string, dto: CambiarPasswordDto, actorId: string) {
    const usuario = await this.exigir(id);
    usuario.passwordHash = this.encryption.hashPassword(dto.password);
    // Restablecer la contraseña también libera el bloqueo por fuerza bruta:
    // si no, el usuario seguiría sin poder entrar con la contraseña nueva.
    usuario.failedLoginAttempts = 0;
    usuario.lockedUntil = null;

    await this.usuarios.save(usuario);
    logger.audit({ tipo: 'usuario_password_restablecida', usuarioId: id, actorId });
  }

  async eliminar(id: string, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('No puede eliminar su propia cuenta');
    }
    const usuario = await this.exigir(id);
    if (usuario.role === 'admin') await this.exigirOtroAdminActivo(id);

    // Borrado lógico: los servicios guardan quién los creó, y un borrado real
    // dejaría esa referencia apuntando a la nada.
    await this.usuarios.softDelete(id);
    logger.audit({ tipo: 'usuario_eliminado', usuarioId: id, actorId });
  }

  // ============================================
  // Apoyo
  // ============================================

  private async exigir(id: string): Promise<User> {
    const usuario = await this.usuarios.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  /** El email y el usuario son únicos incluso contra registros dados de baja. */
  private async exigirDisponible(email?: string, username?: string, excluirId?: string) {
    const condiciones: Record<string, unknown>[] = [];
    if (email) condiciones.push({ email });
    if (username) condiciones.push({ username });
    if (condiciones.length === 0) return;

    const choques = await this.usuarios.find({
      where: condiciones,
      withDeleted: true,
    });
    const ajeno = choques.find((u) => u.id !== excluirId);
    if (ajeno) throw new ConflictException('El email o usuario ya está registrado');
  }

  /**
   * Quedarse sin ningún administrador activo deja el sistema sin quien
   * gestione usuarios ni catálogos, y sin forma de arreglarlo desde la
   * aplicación.
   */
  private async exigirOtroAdminActivo(excluirId: string) {
    const otros = await this.usuarios.count({
      where: { role: 'admin', isActive: true, id: Not(excluirId) },
    });
    if (otros === 0) {
      throw new BadRequestException(
        'Debe quedar al menos un administrador activo en el sistema',
      );
    }
  }

  private presentar(u: User) {
    return {
      id: u.id,
      email: u.email,
      username: u.username,
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      role: u.role,
      isActive: u.isActive,
      mfaEnabled: u.mfaEnabled,
      bloqueado: Boolean(u.lockedUntil && u.lockedUntil > new Date()),
      ultimoAcceso: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt?.toISOString() ?? null,
    };
  }
}

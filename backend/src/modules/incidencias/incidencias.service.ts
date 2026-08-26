import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incidencia } from '../../database/entities/incidencia.entity';
import { TipoIncidencia } from '../../database/entities/catalogos.entities';
import { Conductor } from '../../database/entities/transportes.entities';
import { Servicio } from '../../database/entities/servicio.entity';
import { User } from '../auth/entities/user.entity';
import type { CrearIncidenciaDto, FiltroIncidenciasDto } from './dto/incidencia.dto';
import logger from '../../common/logger';

@Injectable()
export class IncidenciasService {
  constructor(
    @InjectRepository(Incidencia) private readonly incidencias: Repository<Incidencia>,
    @InjectRepository(TipoIncidencia)
    private readonly tiposIncidencia: Repository<TipoIncidencia>,
    @InjectRepository(Conductor) private readonly conductores: Repository<Conductor>,
    @InjectRepository(Servicio) private readonly servicios: Repository<Servicio>,
  ) {}

  async listar(filtro: FiltroIncidenciasDto) {
    const qb = this.incidencias
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.conductor', 'conductor')
      .leftJoinAndSelect('i.tipo', 'tipo')
      .leftJoinAndSelect('i.servicio', 'servicio')
      .leftJoinAndSelect('i.creadoPor', 'creadoPor')
      .orderBy('i.createdAt', 'DESC');

    if (filtro.conductorId) qb.andWhere('conductor.id = :c', { c: filtro.conductorId });
    if (filtro.servicioId) qb.andWhere('servicio.id = :s', { s: filtro.servicioId });
    if (filtro.tipoId) qb.andWhere('tipo.id = :t', { t: filtro.tipoId });

    const registros = await qb.getMany();
    return registros.map((i) => this.presentar(i));
  }

  async crear(dto: CrearIncidenciaDto, usuarioId?: string) {
    if (!dto.conductorId && !dto.operadorNombre?.trim()) {
      throw new BadRequestException(
        'Se necesita el operador de catálogo o su nombre para reportar la incidencia',
      );
    }

    const tipo = await this.tiposIncidencia.findOne({ where: { id: dto.tipoId } });
    if (!tipo) throw new NotFoundException('Tipo de incidencia no encontrado');

    const conductor = dto.conductorId
      ? await this.conductores.findOne({ where: { id: dto.conductorId } })
      : null;
    if (dto.conductorId && !conductor) {
      throw new NotFoundException('Operador no encontrado');
    }

    const servicio = dto.servicioId
      ? await this.servicios.findOne({ where: { id: dto.servicioId } })
      : null;
    if (dto.servicioId && !servicio) {
      throw new NotFoundException('Servicio no encontrado');
    }

    const incidencia = this.incidencias.create({
      conductor,
      operadorNombre: conductor ? null : dto.operadorNombre?.trim() || null,
      tipo,
      servicio,
      descripcion: dto.descripcion?.trim() || null,
      creadoPor: usuarioId ? ({ id: usuarioId } as User) : null,
    });

    const guardado = await this.incidencias.save(incidencia);
    logger.audit({
      tipo: 'incidencia_creada',
      incidenciaId: guardado.id,
      conductorId: dto.conductorId,
      tipoIncidencia: tipo.nombre,
    });
    return this.presentar(await this.incidencias.findOneOrFail({
      where: { id: guardado.id },
      relations: ['conductor', 'tipo', 'servicio', 'creadoPor'],
    }));
  }

  private presentar(i: Incidencia) {
    return {
      id: i.id,
      conductorId: i.conductor?.id ?? null,
      operador: i.conductor?.nombreCompleto ?? i.operadorNombre ?? '',
      tipoId: i.tipo.id,
      tipo: i.tipo.nombre,
      servicioId: i.servicio?.id ?? null,
      folio: i.servicio?.folio ?? null,
      descripcion: i.descripcion,
      creadoPor: i.creadoPor?.username ?? null,
      createdAt: i.createdAt.toISOString(),
    };
  }
}

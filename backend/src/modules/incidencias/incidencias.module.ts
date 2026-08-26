import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incidencia } from '../../database/entities/incidencia.entity';
import { TipoIncidencia } from '../../database/entities/catalogos.entities';
import { Conductor } from '../../database/entities/transportes.entities';
import { Servicio } from '../../database/entities/servicio.entity';
import { IncidenciasService } from './incidencias.service';
import { IncidenciasController } from './incidencias.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Incidencia, TipoIncidencia, Conductor, Servicio])],
  controllers: [IncidenciasController],
  providers: [IncidenciasService],
})
export class IncidenciasModule {}

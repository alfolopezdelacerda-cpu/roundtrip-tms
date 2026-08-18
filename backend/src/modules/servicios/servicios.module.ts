import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiciosService } from './servicios.service';
import { ServiciosController } from './servicios.controller';
import { Servicio } from '../../database/entities/servicio.entity';
import { ENTIDADES_CATALOGOS } from '../../database/entities/catalogos.entities';
import { Conductor, Vehiculo } from '../../database/entities/transportes.entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Servicio,
      ...ENTIDADES_CATALOGOS,
      Vehiculo,
      Conductor,
    ]),
  ],
  providers: [ServiciosService],
  controllers: [ServiciosController],
  exports: [ServiciosService],
})
export class ServiciosModule {}

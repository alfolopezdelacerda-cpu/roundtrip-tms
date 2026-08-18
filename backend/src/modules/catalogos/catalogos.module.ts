import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogosService } from './catalogos.service';
import { CatalogosController } from './catalogos.controller';
import { ENTIDADES_CATALOGOS } from '../../database/entities/catalogos.entities';
import { Conductor, Vehiculo } from '../../database/entities/transportes.entities';
import { Servicio } from '../../database/entities/servicio.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([...ENTIDADES_CATALOGOS, Vehiculo, Conductor, Servicio]),
  ],
  providers: [CatalogosService],
  controllers: [CatalogosController],
  exports: [CatalogosService],
})
export class CatalogosModule {}

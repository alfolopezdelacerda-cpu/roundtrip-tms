import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartaPorte } from './entities/carta-porte.entity';
import { Servicio } from '../../database/entities/servicio.entity';
import { CartaPorteService } from './carta-porte.service';
import { CartaPorteController } from './carta-porte.controller';
import { SelladoService } from './sellado.service';
import { PacService } from './pac/pac.service';

/**
 * Emisión fiscal: CFDI 4.0 de traslado con Complemento Carta Porte 3.1.
 *
 * El sellado y el timbrado viven en servicios separados porque tienen dueños
 * distintos: el CSD es de la empresa y el timbre lo emite el PAC. Cada uno
 * puede fallar por su cuenta y hay que poder diagnosticarlos por separado.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CartaPorte, Servicio])],
  providers: [CartaPorteService, SelladoService, PacService],
  controllers: [CartaPorteController],
  exports: [CartaPorteService],
})
export class SatModule {}

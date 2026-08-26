import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IncidenciasService } from './incidencias.service';
import { CrearIncidenciaDto, FiltroIncidenciasDto } from './dto/incidencia.dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('api/v1/incidencias')
export class IncidenciasController {
  constructor(private readonly incidencias: IncidenciasService) {}

  @Get()
  listar(@Query() filtro: FiltroIncidenciasDto) {
    return this.incidencias.listar(filtro);
  }

  // Quien reporta una incidencia es quien monitorea o dirige la operación.
  @Post()
  @Roles('admin', 'manager', 'dispatcher')
  @UseGuards(RolesGuard)
  crear(@Body() dto: CrearIncidenciaDto, @CurrentUser('id') usuarioId: string) {
    return this.incidencias.crear(dto, usuarioId);
  }
}

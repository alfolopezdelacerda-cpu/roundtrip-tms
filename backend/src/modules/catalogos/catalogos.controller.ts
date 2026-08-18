import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CatalogosService,
  TIPOS_CATALOGO,
  type TipoCatalogo,
} from './catalogos.service';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CatalogoDto } from './dto/catalogo.dto';

/**
 * Un solo controlador para los siete catálogos: todos tienen la misma forma
 * (listar, crear, editar, dar de baja) y solo cambian sus campos, que valida
 * `CatalogoDto` según el tipo.
 */
@Controller('api/v1/catalogos')
export class CatalogosController {
  constructor(private readonly catalogos: CatalogosService) {}

  @Get(':tipo')
  listar(@Param('tipo') tipo: string, @Query('activos') activos?: string) {
    return this.catalogos.listar(this.validar(tipo), activos === 'true');
  }

  @Get(':tipo/:id')
  obtener(@Param('tipo') tipo: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalogos.obtener(this.validar(tipo), id);
  }

  @Get(':tipo/:id/usos')
  async usos(@Param('tipo') tipo: string, @Param('id', ParseUUIDPipe) id: string) {
    return { usos: await this.catalogos.usos(this.validar(tipo), id) };
  }

  // Los catálogos definen el maestro de la operación: solo admin y manager.
  @Post(':tipo')
  @Roles('admin', 'manager')
  @UseGuards(RolesGuard)
  crear(@Param('tipo') tipo: string, @Body() dto: CatalogoDto) {
    return this.catalogos.crear(this.validar(tipo), { ...dto });
  }

  @Patch(':tipo/:id')
  @Roles('admin', 'manager')
  @UseGuards(RolesGuard)
  actualizar(
    @Param('tipo') tipo: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CatalogoDto,
  ) {
    return this.catalogos.actualizar(this.validar(tipo), id, { ...dto });
  }

  @Delete(':tipo/:id')
  @Roles('admin', 'manager')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('tipo') tipo: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalogos.eliminar(this.validar(tipo), id);
  }

  private validar(tipo: string): TipoCatalogo {
    if (!TIPOS_CATALOGO.includes(tipo as TipoCatalogo)) {
      throw new BadRequestException(
        `Catálogo desconocido: ${tipo}. Válidos: ${TIPOS_CATALOGO.join(', ')}`,
      );
    }
    return tipo as TipoCatalogo;
  }
}

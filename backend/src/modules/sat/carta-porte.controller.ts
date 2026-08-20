import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CartaPorteService } from './carta-porte.service';
import { CancelarDto } from './dto/carta-porte.dto';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CLAVES_PROD_SERV_CP,
  CLAVES_UNIDAD,
  CONFIG_AUTOTRANSPORTE,
  FIGURAS_TRANSPORTE,
  MOTIVOS_CANCELACION,
  REGIMENES_FISCALES,
  TIPOS_PERMISO_SCT,
} from './sat-catalogos';

@Controller('api/v1/sat')
export class CartaPorteController {
  constructor(private readonly cartaPorte: CartaPorteService) {}

  /** Catálogos SAT para poblar los desplegables del alta. */
  @Get('catalogos')
  catalogos() {
    return {
      configAutotransporte: CONFIG_AUTOTRANSPORTE,
      tipoPermiso: TIPOS_PERMISO_SCT,
      figuraTransporte: FIGURAS_TRANSPORTE,
      claveUnidad: CLAVES_UNIDAD,
      claveProdServCP: CLAVES_PROD_SERV_CP,
      regimenFiscal: REGIMENES_FISCALES,
      motivoCancelacion: MOTIVOS_CANCELACION,
    };
  }

  @Get('cartas-porte')
  listar() {
    return this.cartaPorte.listar();
  }

  /** Qué falta para poder emitir. No emite nada ni cuesta timbre. */
  @Get('servicios/:id/validar')
  validar(@Param('id', ParseUUIDPipe) id: string) {
    return this.cartaPorte.validar(id);
  }

  @Get('servicios/:id/carta-porte')
  async obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.cartaPorte.presentar(await this.cartaPorte.obtenerPorServicio(id));
  }

  /** Descarga el XML: el timbrado si existe, si no el sellado. */
  @Get('servicios/:id/carta-porte/xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async xml(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('version') version?: string,
  ) {
    const carta = await this.cartaPorte.obtenerPorServicio(id);
    const contenido =
      version === 'sellado'
        ? carta.xmlSinSellar
        : (carta.xmlTimbrado ?? carta.xmlSinSellar);

    if (!contenido) {
      throw new NotFoundException('La carta porte todavía no tiene XML generado');
    }
    return contenido;
  }

  // Emitir y cancelar comprobantes fiscales: solo admin y manager.
  @Post('servicios/:id/carta-porte/generar')
  @Roles('admin', 'manager')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async generar(@Param('id', ParseUUIDPipe) id: string) {
    return this.cartaPorte.presentar(await this.cartaPorte.generar(id));
  }

  @Post('servicios/:id/carta-porte/timbrar')
  @Roles('admin', 'manager')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async timbrar(@Param('id', ParseUUIDPipe) id: string) {
    return this.cartaPorte.presentar(await this.cartaPorte.timbrar(id));
  }

  @Post('servicios/:id/carta-porte/cancelar')
  @Roles('admin', 'manager')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelarDto,
  ) {
    return this.cartaPorte.presentar(
      await this.cartaPorte.cancelar(id, dto.motivo, dto.uuidSustitucion),
    );
  }
}

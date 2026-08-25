import {
  Body,
  Controller,
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
import { ServiciosService } from './servicios.service';
import {
  ActualizarCostosDto,
  ActualizarMonitoreoDto,
  ActualizarServicioDto,
  CambiarEstadoDto,
  CrearServicioDto,
  FacturarDto,
  FiltroServiciosDto,
  PagarDto,
} from './dto/servicio.dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('api/v1/servicios')
export class ServiciosController {
  constructor(private readonly servicios: ServiciosService) {}

  /** Alimenta las vistas de asignación, monitoreo, CXC, CXP y liquidación. */
  @Get()
  listar(@Query() filtro: FiltroServiciosDto) {
    return this.servicios.listar(filtro);
  }

  /** Cifras del tablero. Va antes de `:id` para no confundirse con un uuid. */
  @Get('resumen')
  resumen() {
    return this.servicios.resumen();
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicios.obtener(id);
  }

  @Post()
  @Roles('admin', 'manager', 'dispatcher')
  @UseGuards(RolesGuard)
  crear(@Body() dto: CrearServicioDto, @CurrentUser('id') usuarioId: string) {
    return this.servicios.crear(dto, usuarioId);
  }

  @Patch(':id')
  @Roles('admin', 'manager', 'dispatcher')
  @UseGuards(RolesGuard)
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarServicioDto,
  ) {
    return this.servicios.actualizar(id, dto);
  }

  /** Desglose del costo operativo (Finanzas › Rentabilidad por viaje). */
  @Patch(':id/costos')
  @Roles('admin', 'manager', 'accountant')
  @UseGuards(RolesGuard)
  actualizarCostos(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCostosDto,
  ) {
    return this.servicios.actualizarCostos(id, dto);
  }

  /** Datos manuales que se capturan cuando el servicio cae en Monitoreo. */
  @Patch(':id/monitoreo')
  @Roles('admin', 'manager', 'dispatcher')
  @UseGuards(RolesGuard)
  actualizarMonitoreo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarMonitoreoDto,
  ) {
    return this.servicios.actualizarMonitoreo(id, dto);
  }

  /** Monitoreo: el operador de tráfico mueve el estado y el avance. */
  @Post(':id/estado')
  @Roles('admin', 'manager', 'dispatcher')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoDto,
  ) {
    return this.servicios.cambiarEstado(id, dto);
  }

  // Cobranza y pagos: contabilidad, más admin y manager por jerarquía.
  @Post(':id/facturar')
  @Roles('admin', 'manager', 'accountant')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  facturar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FacturarDto) {
    return this.servicios.facturar(id, dto.factura, dto.fechaFactura);
  }

  @Post(':id/cobrar')
  @Roles('admin', 'manager', 'accountant')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  cobrar(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicios.marcarCobrado(id);
  }

  @Post(':id/autorizar-pago')
  @Roles('admin', 'manager', 'accountant')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  autorizarPago(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicios.autorizarPago(id);
  }

  @Post(':id/pagar')
  @Roles('admin', 'manager', 'accountant')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  pagar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PagarDto) {
    return this.servicios.marcarPagado(id, dto.referencia);
  }

  @Post(':id/liquidar')
  @Roles('admin', 'manager', 'accountant')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  liquidar(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicios.liquidar(id);
  }

  /** Recalcula vencimientos de CXC. Pensado para una tarea diaria. */
  @Post('cxc/marcar-vencidos')
  @Roles('admin', 'manager', 'accountant')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async marcarVencidos() {
    return { vencidos: await this.servicios.marcarVencidos() };
  }
}

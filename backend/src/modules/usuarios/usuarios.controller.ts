import {
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
  UseGuards,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import {
  ActualizarUsuarioDto,
  CambiarPasswordDto,
  CrearUsuarioDto,
} from './dto/usuario.dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PERMISOS_POR_ROL } from './permisos';

/**
 * Panel de administración de usuarios. Todo el controlador es de `admin`:
 * quien puede crear cuentas y repartir roles manda sobre el sistema entero.
 */
@Controller('api/v1/usuarios')
@Roles('admin')
@UseGuards(RolesGuard)
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  listar() {
    return this.usuarios.listar();
  }

  /**
   * Qué puede hacer cada rol. Se sirve desde el servidor para que el panel
   * muestre los permisos reales y no una copia que se desincroniza.
   */
  @Get('permisos')
  permisos() {
    return PERMISOS_POR_ROL;
  }

  @Post()
  crear(@Body() dto: CrearUsuarioDto, @CurrentUser('id') actorId: string) {
    return this.usuarios.crear(dto, actorId);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarUsuarioDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.usuarios.actualizar(id, dto, actorId);
  }

  @Post(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  cambiarPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarPasswordDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.usuarios.cambiarPassword(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.usuarios.eliminar(id, actorId);
  }
}

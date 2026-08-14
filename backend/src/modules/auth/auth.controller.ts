import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AuthService, type PayloadJwt } from './auth.service';
import {
  LoginDto,
  MfaVerifyDto,
  RefreshTokenDto,
  RegisterDto,
} from './dto/auth.dto';
import { CurrentUser, Public, Roles, type UsuarioPeticion } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Alta de usuarios. Restringido a admin: el registro abierto no aplica en
   * un TMS interno.
   */
  @Post('register')
  @Roles('admin')
  @UseGuards(RolesGuard)
  async registrar(@Body() dto: RegisterDto, @CurrentUser('id') creadoPor: string) {
    const usuario = await this.authService.registrar(dto, creadoPor);
    return {
      id: usuario.id,
      email: usuario.email,
      username: usuario.username,
      role: usuario.role,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, request.ip);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refrescar(@Body() dto: RefreshTokenDto) {
    return this.authService.refrescar(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request & { user?: UsuarioPeticion },
    @Body() dto: { refreshToken?: string },
  ) {
    // `JwtStrategy` normaliza `request.user`; el jti vive en el token, así
    // que se recompone el payload mínimo que `logout` necesita.
    const usuario = request.user;
    const payload = {
      sub: usuario?.id,
      jti: this.leerJti(request),
    } as PayloadJwt;

    await this.authService.logout(payload, dto?.refreshToken);
  }

  @Get('me')
  perfil(@CurrentUser() usuario: UsuarioPeticion) {
    return usuario;
  }

  // ============================================
  // MFA
  // ============================================

  /** Devuelve el secreto y el QR una sola vez; MFA sigue inactivo hasta confirmar. */
  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  iniciarMfa(@CurrentUser('id') usuarioId: string) {
    return this.authService.iniciarAltaMfa(usuarioId);
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  confirmarMfa(@CurrentUser('id') usuarioId: string, @Body() dto: MfaVerifyDto) {
    return this.authService.confirmarAltaMfa(usuarioId, dto.code);
  }

  @Post('mfa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  desactivarMfa(@CurrentUser('id') usuarioId: string) {
    return this.authService.desactivarMfa(usuarioId);
  }

  // ============================================
  // Keycloak
  // ============================================

  /**
   * Verifica un access token emitido por el realm y devuelve el usuario local
   * ya sincronizado.
   */
  @Public()
  @Get('keycloak/me')
  @UseGuards(AuthGuard('keycloak'))
  perfilKeycloak(@CurrentUser() usuario: UsuarioPeticion) {
    return usuario;
  }

  private leerJti(request: Request): string {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return '';
    try {
      const [, payload] = token.split('.');
      const decodificado = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as { jti?: string };
      return decodificado.jti ?? '';
    } catch {
      return '';
    }
  }
}

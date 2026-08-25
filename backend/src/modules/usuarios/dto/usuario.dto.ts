import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { ROLES, type RolUsuario } from '../../auth/entities/user.entity';

/** Misma política de contraseña que el alta de `auth`: no se relaja aquí. */
const REGLA_PASSWORD = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/;
const MENSAJE_PASSWORD =
  'La contraseña debe incluir mayúscula, minúscula, dígito y símbolo';

export class CrearUsuarioDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @Length(3, 100)
  username: string;

  @IsString()
  @MinLength(12)
  @Matches(REGLA_PASSWORD, { message: MENSAJE_PASSWORD })
  password: string;

  @IsIn(ROLES)
  role: RolUsuario;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;
}

/** Todo opcional: es un PATCH. La contraseña se cambia por su propia ruta. */
export class ActualizarUsuarioDto {
  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;

  @IsOptional()
  @IsString()
  @Length(3, 100)
  username?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: RolUsuario;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CambiarPasswordDto {
  @IsString()
  @MinLength(12)
  @Matches(REGLA_PASSWORD, { message: MENSAJE_PASSWORD })
  password: string;
}

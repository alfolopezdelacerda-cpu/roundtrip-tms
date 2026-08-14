import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @MinLength(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
  password: string;

  /** Código TOTP de 6 dígitos, obligatorio si el usuario tiene MFA activo. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código MFA debe ser de 6 dígitos' })
  mfaCode?: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class RegisterDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @Length(3, 100)
  username: string;

  /**
   * Política mínima: 12 caracteres con mayúscula, minúscula, dígito y
   * símbolo. Alineada con el checklist de seguridad del PDR.
   */
  @IsString()
  @MinLength(12)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, {
    message: 'La contraseña debe incluir mayúscula, minúscula, dígito y símbolo',
  })
  password: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;
}

export class MfaVerifyDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código MFA debe ser de 6 dígitos' })
  code: string;
}

export class MfaToggleDto {
  @IsBoolean()
  enabled: boolean;
}

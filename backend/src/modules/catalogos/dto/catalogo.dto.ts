import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

/**
 * Campos aceptados por cualquier catálogo.
 *
 * Va en un solo DTO porque el controlador es genérico y `ValidationPipe`
 * corre con `forbidNonWhitelisted`: enviar un campo que no esté aquí es un
 * 400, así que la lista blanca sigue siendo estricta aunque sea común.
 */
export class CatalogoDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // --- clientes ---
  @IsOptional()
  @IsString()
  @Length(0, 13)
  rfc?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  diasCredito?: number;

  // --- tipos de unidad ---
  @IsOptional()
  @IsBoolean()
  full?: boolean;

  // --- unidades (vehículos) ---
  @IsOptional()
  @IsString()
  @Length(1, 30)
  economico?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  placa?: string;

  @IsOptional()
  @IsIn(['full_trailer', 'sencillo', 'rabon', 'pickup'])
  tipo?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacidadToneladas?: number;

  // --- operadores (conductores) ---
  @IsOptional()
  @IsString()
  @Length(1, 255)
  licencia?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  telefono?: string;

  /**
   * Estado operativo. Los valores válidos difieren entre unidades
   * (operativo/mantenimiento/…) y operadores (activo/inactivo/…), así que se
   * validan juntos y el repositorio rechaza el que no corresponda.
   */
  @IsOptional()
  @IsIn([
    'operativo',
    'mantenimiento',
    'fuera_servicio',
    'vendido',
    'activo',
    'inactivo',
    'suspendido',
    'baja',
  ])
  estado?: string;
}

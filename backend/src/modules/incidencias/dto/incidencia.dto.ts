import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CrearIncidenciaDto {
  @IsOptional()
  @IsUUID()
  conductorId?: string;

  /** Nombre del operador cuando no hay conductor de catálogo (FWD). */
  @IsOptional()
  @IsString()
  @Length(1, 255)
  operadorNombre?: string;

  @IsUUID()
  tipoId: string;

  @IsOptional()
  @IsUUID()
  servicioId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  descripcion?: string;
}

export class FiltroIncidenciasDto {
  @IsOptional()
  @IsUUID()
  conductorId?: string;

  @IsOptional()
  @IsUUID()
  servicioId?: string;

  @IsOptional()
  @IsUUID()
  tipoId?: string;
}

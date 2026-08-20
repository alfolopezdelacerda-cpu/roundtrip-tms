import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { MOTIVOS_CANCELACION } from '../sat-catalogos';

export class CancelarDto {
  @IsIn(MOTIVOS_CANCELACION.map((m) => m.clave))
  motivo: string;

  /** Obligatorio con el motivo 01; el servicio lo verifica. */
  @IsOptional()
  @IsUUID()
  uuidSustitucion?: string;
}

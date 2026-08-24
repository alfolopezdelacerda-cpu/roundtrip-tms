import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import {
  ESTADOS_COBRO,
  ESTADOS_PAGO,
  ESTADOS_SERVICIO,
} from '../../../database/entities/servicio.entity';

export class CrearServicioDto {
  @IsUUID()
  clienteId: string;

  @IsString()
  @Length(1, 255)
  origen: string;

  @IsString()
  @Length(1, 255)
  destino: string;

  @IsUUID()
  puertoId: string;

  @IsDateString()
  citaCarga: string;

  @IsOptional()
  @IsDateString()
  citaDescarga?: string;

  @IsIn(['TDC', 'FWD'])
  asignacion: 'TDC' | 'FWD';

  @IsOptional()
  @IsUUID()
  unidadId?: string;

  @IsOptional()
  @IsUUID()
  operadorId?: string;

  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @IsOptional()
  @IsUUID()
  tipoNegocioId?: string;

  @IsOptional()
  @IsIn(['RF', 'SECO'])
  temperatura?: 'RF' | 'SECO';

  @IsOptional()
  @IsIn(['OW', 'RT'])
  modalidad?: 'OW' | 'RT';

  @IsOptional()
  @IsUUID()
  tipoUnidadId?: string;

  @IsOptional()
  @IsUUID()
  tipoMercanciaId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  contenedor1?: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  contenedor2?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  booking?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  po?: string;

  @IsOptional()
  @IsIn(ESTADOS_SERVICIO)
  estado?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  km?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tarifa?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costo?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  diasCredito?: number;

  // --- Datos del complemento Carta Porte ---
  @IsOptional()
  @IsString()
  @Length(5, 5)
  cpOrigen?: string;

  @IsOptional()
  @IsString()
  @Length(5, 5)
  cpDestino?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pesoBrutoTotal?: number;

  @IsOptional()
  @IsString()
  @Length(2, 5)
  unidadPeso?: string;

  @IsOptional()
  @IsString()
  @Length(8, 10)
  claveProdServCP?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

/** Todo opcional: es un PATCH. Folio y carta porte nunca se editan. */
export class ActualizarServicioDto extends CrearServicioDto {
  @IsOptional()
  @IsUUID()
  declare clienteId: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  declare origen: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  declare destino: string;

  @IsOptional()
  @IsUUID()
  declare puertoId: string;

  @IsOptional()
  @IsDateString()
  declare citaCarga: string;

  @IsOptional()
  @IsIn(['TDC', 'FWD'])
  declare asignacion: 'TDC' | 'FWD';
}

export class CambiarEstadoDto {
  @IsIn(ESTADOS_SERVICIO)
  estado: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  ubicacion?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  evento?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  avance?: number;
}

export class FacturarDto {
  @IsString()
  @Length(1, 50)
  factura: string;

  @IsOptional()
  @IsDateString()
  fechaFactura?: string;
}

export class PagarDto {
  @IsString()
  @Length(1, 100)
  referencia: string;
}

/**
 * Campos que se capturan a mano cuando el servicio llega a Monitoreo:
 * operador, medio de comunicación, unidad y placa reales. No vienen de un
 * catálogo porque en FWD son del proveedor, y en TDC pueden diferir de lo que
 * se asignó al programar.
 */
export class ActualizarMonitoreoDto {
  @IsOptional()
  @IsString()
  @Length(0, 255)
  operadorManual?: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  medioComunicacion?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  unidadManual?: string;

  @IsOptional()
  @IsString()
  @Length(0, 20)
  placaManual?: string;
}

export class FiltroServiciosDto {
  @IsOptional()
  @IsIn(['TDC', 'FWD'])
  asignacion?: 'TDC' | 'FWD';

  @IsOptional()
  @IsIn(ESTADOS_SERVICIO)
  estado?: string;

  @IsOptional()
  @IsIn(ESTADOS_COBRO)
  cobro?: string;

  @IsOptional()
  @IsIn(ESTADOS_PAGO)
  pago?: string;

  @IsOptional()
  @IsIn(['pendiente', 'liquidado'])
  liquidacion?: string;

  /** Solo servicios en curso (programado, en ruta, en destino). */
  @IsOptional()
  @IsBoolean()
  activos?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  buscar?: string;
}

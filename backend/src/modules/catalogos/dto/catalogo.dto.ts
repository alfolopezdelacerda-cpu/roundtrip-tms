import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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

  /** c_RegimenFiscal del receptor: obligatorio para emitir CFDI 4.0. */
  @IsOptional()
  @IsString()
  @Length(3, 5)
  regimenFiscal?: string;

  @IsOptional()
  @IsString()
  @Length(5, 5)
  codigoPostal?: string;

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
  placas?: string;

  /**
   * Tipo: de unidad (full_trailer…) o de proveedor (transportista…). Se
   * validan juntos porque el controlador es genérico; el repositorio rechaza
   * el valor que no corresponda a su tabla.
   */
  @IsOptional()
  @IsIn([
    'full_trailer',
    'sencillo',
    'rabon',
    'pickup',
    'transportista',
    'agente_aduanal',
    'almacen',
    'seguros',
  ])
  tipo?: string;

  // --- proveedores ---
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  diasPago?: number;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  contacto?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacidadTon?: number;

  // --- unidades: datos del complemento Carta Porte ---
  @IsOptional()
  @IsString()
  @Length(2, 10)
  configVehicular?: string;

  @IsOptional()
  @IsString()
  @Length(4, 10)
  permisoSct?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  numPermisoSct?: string;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  anio?: number;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  aseguradoraCivil?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  polizaCivil?: string;

  // --- unidades: expediente de Flota ---
  @IsOptional()
  @IsString()
  @Length(1, 100)
  modelo?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  marca?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  vin?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  color?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  polizaSeguro?: string;

  @IsOptional()
  @IsDateString()
  vencimientoSeguro?: string;

  @IsOptional()
  @IsBoolean()
  verificacionVigente?: boolean;

  @IsOptional()
  @IsDateString()
  verificacionVencimiento?: string;

  /** Data URLs (base64): expediente digital de la unidad. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fotos?: string[];

  @IsOptional()
  @IsArray()
  documentos?: { nombre: string; datos: string }[];

  // --- operadores (conductores) ---
  @IsOptional()
  @IsString()
  @Length(1, 255)
  licencia?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  celular?: string;

  /** CURP del operador; se guarda cifrada como el RFC. */
  @IsOptional()
  @IsString()
  @Length(18, 18)
  curp?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  contactoEmergencia?: string;

  /** Número de seguridad social (IMSS). */
  @IsOptional()
  @IsString()
  @Length(1, 20)
  nss?: string;

  // --- rutas ---
  @IsOptional()
  @IsString()
  @Length(1, 30)
  codigo?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  origen?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  destino?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  kmProyectados?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  casetasProyectadas?: number;

  // --- tarifas (Ventas) ---
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tarifaVenta?: number;

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

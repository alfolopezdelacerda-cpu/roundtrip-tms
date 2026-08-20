/**
 * Subconjunto de los catálogos del SAT que usa la emisión de carta porte.
 *
 * El SAT publica estos catálogos completos en hojas de cálculo con miles de
 * renglones (c_ClaveProdServCP solo trae más de mil). Aquí van las claves que
 * la operación usa a diario, para poder validar en el alta sin depender de una
 * descarga.
 *
 * IMPORTANTE: son un subconjunto, no la fuente de verdad. Antes de producción
 * hay que cargar los catálogos oficiales completos y vigentes; el SAT los
 * actualiza y una clave dada de baja hace que el PAC rechace el timbrado.
 */

export type ClaveSat = { clave: string; descripcion: string };

/** c_ConfigAutotransporte: configuración vehicular. */
export const CONFIG_AUTOTRANSPORTE: ClaveSat[] = [
  { clave: 'VL', descripcion: 'Vehículo ligero de carga (2 llantas en el eje delantero y 2 en el trasero)' },
  { clave: 'C2', descripcion: 'Camión Unitario (2 llantas en el eje delantero y 4 en el eje trasero)' },
  { clave: 'C3', descripcion: 'Camión Unitario (2 llantas en el eje delantero y 6 o 8 en los dos ejes traseros)' },
  { clave: 'T3S2', descripcion: 'Tractocamión Articulado (3 ejes en tractocamión y 2 ejes en semirremolque)' },
  { clave: 'T3S3', descripcion: 'Tractocamión Articulado (3 ejes en tractocamión y 3 ejes en semirremolque)' },
  { clave: 'T3S2R4', descripcion: 'Tractocamión Doblemente Articulado (full)' },
  { clave: 'T3S1R2', descripcion: 'Tractocamión Doblemente Articulado (3-1-2)' },
];

/** c_TipoPermiso: permiso de la SCT bajo el que se transporta. */
export const TIPOS_PERMISO_SCT: ClaveSat[] = [
  { clave: 'TPAF01', descripcion: 'Autotransporte Federal de carga general' },
  { clave: 'TPAF02', descripcion: 'Transporte privado de carga' },
  { clave: 'TPAF03', descripcion: 'Autotransporte Federal de Carga Especializada de materiales y residuos peligrosos' },
  { clave: 'TPAF04', descripcion: 'Transporte de automóviles sin rodar en vehículo tipo góndola' },
  { clave: 'TPAF05', descripcion: 'Transporte de carga de gran peso y/o volumen' },
  { clave: 'TPAF06', descripcion: 'Transporte de objetos voluminosos y/o de gran peso' },
];

/** c_FiguraTransporte: papel de la persona que interviene en el traslado. */
export const FIGURAS_TRANSPORTE: ClaveSat[] = [
  { clave: '01', descripcion: 'Operador' },
  { clave: '02', descripcion: 'Propietario' },
  { clave: '03', descripcion: 'Arrendador' },
  { clave: '04', descripcion: 'Notificado' },
];

/** c_ClaveUnidad: unidades de medida más usadas en carga. */
export const CLAVES_UNIDAD: ClaveSat[] = [
  { clave: 'KGM', descripcion: 'Kilogramo' },
  { clave: 'TNE', descripcion: 'Tonelada métrica' },
  { clave: 'XPK', descripcion: 'Paquete' },
  { clave: 'XBX', descripcion: 'Caja' },
  { clave: 'XPX', descripcion: 'Tarima' },
  { clave: 'E48', descripcion: 'Unidad de servicio' },
];

/** c_ClaveProdServCP: claves de producto/servicio para la mercancía. */
export const CLAVES_PROD_SERV_CP: ClaveSat[] = [
  { clave: '01010101', descripcion: 'No existe en el catálogo' },
  { clave: '11121800', descripcion: 'Materiales de construcción' },
  { clave: '24101602', descripcion: 'Contenedores de carga' },
  { clave: '50000000', descripcion: 'Alimentos, bebidas y tabaco' },
  { clave: '53100000', descripcion: 'Ropa y textiles' },
  { clave: '25100000', descripcion: 'Vehículos de motor' },
  { clave: '31000000', descripcion: 'Componentes y suministros de manufactura' },
];

/** Clave de producto/servicio del CONCEPTO del CFDI de traslado. */
export const CLAVE_PROD_SERV_TRASLADO = '78101800'; // Transporte de carga por carretera

/** c_RegimenFiscal: los que aplican a personas morales y físicas con actividad. */
export const REGIMENES_FISCALES: ClaveSat[] = [
  { clave: '601', descripcion: 'General de Ley Personas Morales' },
  { clave: '603', descripcion: 'Personas Morales con Fines no Lucrativos' },
  { clave: '605', descripcion: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { clave: '612', descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { clave: '616', descripcion: 'Sin obligaciones fiscales' },
  { clave: '626', descripcion: 'Régimen Simplificado de Confianza' },
];

/** Motivos de cancelación vigentes (CFDI 4.0). */
export const MOTIVOS_CANCELACION: ClaveSat[] = [
  { clave: '01', descripcion: 'Comprobante emitido con errores con relación' },
  { clave: '02', descripcion: 'Comprobante emitido con errores sin relación' },
  { clave: '03', descripcion: 'No se llevó a cabo la operación' },
  { clave: '04', descripcion: 'Operación nominativa relacionada en una factura global' },
];

const claves = (lista: ClaveSat[]) => new Set(lista.map((c) => c.clave));

const VALIDOS: Record<string, Set<string>> = {
  configAutotransporte: claves(CONFIG_AUTOTRANSPORTE),
  tipoPermiso: claves(TIPOS_PERMISO_SCT),
  figuraTransporte: claves(FIGURAS_TRANSPORTE),
  claveUnidad: claves(CLAVES_UNIDAD),
  claveProdServCP: claves(CLAVES_PROD_SERV_CP),
  regimenFiscal: claves(REGIMENES_FISCALES),
  motivoCancelacion: claves(MOTIVOS_CANCELACION),
};

export function esClaveValida(catalogo: keyof typeof VALIDOS, clave: string): boolean {
  return VALIDOS[catalogo]?.has(clave) ?? false;
}

/**
 * RFC de persona moral (12) o física (13). No valida el dígito verificador:
 * de eso se encarga el PAC, que además consulta la LCO.
 */
export const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/;

/** Código postal mexicano. */
export const CP_REGEX = /^\d{5}$/;

/** Placa sin guiones ni espacios, como la exige el complemento. */
export const PLACA_REGEX = /^[A-Z\d]{5,7}$/;

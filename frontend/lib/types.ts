export type EstadoViaje =
  | "programado"
  | "en_ruta_ida"
  | "en_destino"
  | "en_ruta_vuelta"
  | "completado"
  | "cancelado";

/**
 * Cómo se cubre el servicio:
 * - TDC: con la transportadora propia (flota y operador ADL).
 * - FWD: con un proveedor externo, es decir todo lo que no se asigna a ADL.
 *
 * De esta distinción cuelga el resto del flujo: un servicio FWD genera cuenta
 * por pagar al proveedor; uno TDC genera liquidación al operador.
 */
export type Asignacion = "TDC" | "FWD";

/** One way (solo ida) o round trip (ida y vuelta). */
export type Modalidad = "OW" | "RT";

/** Refrigerado o seco. */
export type Temperatura = "RF" | "SECO";

export type EstadoCobro = "pendiente" | "facturado" | "cobrado" | "vencido";
export type EstadoPago = "pendiente" | "autorizado" | "pagado";
export type EstadoLiquidacion = "pendiente" | "liquidado";

export type EstadoUnidad = "disponible" | "en_viaje" | "taller";
export type EstadoOperador = "disponible" | "en_viaje" | "descanso";

export type Viaje = {
  id: string;
  folio: string;
  /** Folio de carta porte, asignado automáticamente al guardar. */
  cartaPorte: string;

  clienteId: string;
  /** Nombre del cliente al momento del alta; sobrevive a cambios del catálogo. */
  cliente: string;

  origen: string;
  destino: string;
  puertoId: string;

  /** Citas con fecha y hora, en ISO local (YYYY-MM-DDTHH:mm). */
  citaCarga: string;
  citaDescarga: string;

  asignacion: Asignacion;
  /** Solo TDC: unidad y operador propios. */
  unidadId: string;
  operadorId: string;
  /** Solo FWD: proveedor que ejecuta el servicio. */
  proveedorId: string;

  tipoNegocioId: string;
  temperatura: Temperatura;
  modalidad: Modalidad;
  tipoUnidadId: string;
  tipoMercanciaId: string;

  contenedor1: string;
  /** Solo si el tipo de unidad es full. */
  contenedor2: string;

  booking: string;
  po: string;

  estado: EstadoViaje;
  km: number;

  /** Lo que se le cobra al cliente (MXN). */
  tarifa: number;
  /** Lo que cuesta ejecutarlo: al proveedor en FWD, operativo en TDC. */
  costo: number;

  cobro: {
    estado: EstadoCobro;
    factura: string | null;
    fechaFactura: string | null;
    diasCredito: number;
  };

  pago: {
    estado: EstadoPago;
    referencia: string | null;
    fechaPago: string | null;
  };

  liquidacion: {
    estado: EstadoLiquidacion;
    fecha: string | null;
  };

  monitoreo: {
    /** 0-100. En completado siempre 100. */
    avance: number;
    ubicacion: string;
    ultimoEvento: string;
    actualizado: string; // ISO
  };

  notas?: string;
};

export type Unidad = {
  id: string;
  economico: string;
  placas: string;
  tipo: string;
  capacidadTon: number;
  estado: EstadoUnidad;
  activo: boolean;
};

export type Operador = {
  id: string;
  nombre: string;
  licencia: string;
  telefono: string;
  estado: EstadoOperador;
  activo: boolean;
};

export type Proveedor = {
  id: string;
  nombre: string;
  tipo: "transportista" | "agente_aduanal" | "almacen";
  diasPago: number;
  contacto: string;
  activo: boolean;
};

export const ESTADOS_VIAJE: { value: EstadoViaje; label: string }[] = [
  { value: "programado", label: "Programado" },
  { value: "en_ruta_ida", label: "En ruta (ida)" },
  { value: "en_destino", label: "En destino" },
  { value: "en_ruta_vuelta", label: "En ruta (vuelta)" },
  { value: "completado", label: "Completado" },
  { value: "cancelado", label: "Cancelado" },
];

export const ESTADO_LABEL: Record<EstadoViaje, string> = ESTADOS_VIAJE.reduce(
  (acc, e) => ({ ...acc, [e.value]: e.label }),
  {} as Record<EstadoViaje, string>,
);

export const ESTADO_CLASS: Record<EstadoViaje, string> = {
  programado: "bg-slate-100 text-slate-700 ring-slate-200",
  en_ruta_ida: "bg-blue-50 text-blue-700 ring-blue-200",
  en_destino: "bg-violet-50 text-violet-700 ring-violet-200",
  en_ruta_vuelta: "bg-amber-50 text-amber-800 ring-amber-200",
  completado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelado: "bg-rose-50 text-rose-700 ring-rose-200",
};

export const COBRO_LABEL: Record<EstadoCobro, string> = {
  pendiente: "Por facturar",
  facturado: "Facturado",
  cobrado: "Cobrado",
  vencido: "Vencido",
};

export const COBRO_CLASS: Record<EstadoCobro, string> = {
  pendiente: "bg-slate-100 text-slate-700 ring-slate-200",
  facturado: "bg-blue-50 text-blue-700 ring-blue-200",
  cobrado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  vencido: "bg-rose-50 text-rose-700 ring-rose-200",
};

export const PAGO_LABEL: Record<EstadoPago, string> = {
  pendiente: "Por autorizar",
  autorizado: "Autorizado",
  pagado: "Pagado",
};

export const PAGO_CLASS: Record<EstadoPago, string> = {
  pendiente: "bg-slate-100 text-slate-700 ring-slate-200",
  autorizado: "bg-amber-50 text-amber-800 ring-amber-200",
  pagado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export const ASIGNACION_LABEL: Record<Asignacion, string> = {
  TDC: "Transportadora",
  FWD: "Proveedor externo",
};

export const ASIGNACION_CLASS: Record<Asignacion, string> = {
  TDC: "bg-teal-50 text-teal-700 ring-teal-200",
  FWD: "bg-indigo-50 text-indigo-700 ring-indigo-200",
};

export const MODALIDAD_LABEL: Record<Modalidad, string> = {
  OW: "One way",
  RT: "Round trip",
};

export const TEMPERATURA_LABEL: Record<Temperatura, string> = {
  RF: "Refrigerado",
  SECO: "Seco",
};

export const TEMPERATURA_CLASS: Record<Temperatura, string> = {
  RF: "bg-sky-50 text-sky-700 ring-sky-200",
  SECO: "bg-stone-100 text-stone-700 ring-stone-200",
};

/** Estados en los que el servicio sigue vivo en la operación. */
export const VIAJE_ACTIVO: EstadoViaje[] = [
  "programado",
  "en_ruta_ida",
  "en_destino",
  "en_ruta_vuelta",
];

/** Un servicio entra a liquidación cuando terminó y aún no se liquidó. */
export function esLiquidable(v: Viaje): boolean {
  return v.estado === "completado" && v.liquidacion.estado === "pendiente";
}

/** Fecha de vencimiento del cobro = fecha de factura + días de crédito. */
export function vencimientoCobro(v: Viaje): string | null {
  if (!v.cobro.fechaFactura) return null;
  const base = new Date(`${v.cobro.fechaFactura}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + v.cobro.diasCredito);
  return base.toISOString().slice(0, 10);
}

/** Margen del servicio: lo que queda después de pagar la ejecución. */
export function margen(v: Viaje): number {
  return v.tarifa - v.costo;
}

/** En round trip la unidad regresa al origen; en one way, no. */
export function rutaTexto(v: Viaje): string {
  return v.modalidad === "RT"
    ? `${v.origen} → ${v.destino} → ${v.origen}`
    : `${v.origen} → ${v.destino}`;
}

/** Fecha de referencia del servicio para ordenar y agrupar. */
export function fechaServicio(v: Viaje): string {
  return v.citaCarga.slice(0, 10);
}

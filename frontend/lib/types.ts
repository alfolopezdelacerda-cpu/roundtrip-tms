export type EstadoViaje =
  | "por_asignar"
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

/**
 * El estado de unidades y operadores lo define el catálogo del backend
 * (`operativo`, `mantenimiento`, `activo`, `baja`…). Se deja abierto para no
 * duplicar aquí un enum que allá puede crecer.
 */
export type EstadoUnidad = string;
export type EstadoOperador = string;

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
  /** Solo TDC: código de ruta: trae km y casetas proyectados. */
  rutaId: string;
  rutaCodigo: string;

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
  /** Solo TDC: casetas proyectadas, copiadas de la ruta al asignar. */
  casetasProyectadas: number;

  /** Tarifa de venta, copiada del tarifario de Ventas al dar de alta. */
  tarifa: number;
  /** Costo total de ejecución: siempre la suma de `costos`, nunca capturado. */
  costo: number;
  /** Desglose del costo operativo (Finanzas › Rentabilidad por viaje). */
  costos: {
    /** Solo FWD: lo que cobra el proveedor. */
    proveedor: number;
    combustible: number;
    casetas: number;
    operador: number;
    otros: number;
  };

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
    combustible: number;
    casetas: number;
    gastosExtra: number;
    gastosExtraDetalle: string | null;
    evidencias: boolean;
  };

  monitoreo: {
    /** 0-100. En completado siempre 100. */
    avance: number;
    /** Manual en ambos: ubicación actual reportada. */
    ubicacion: string;
    ultimoEvento: string;
    actualizado: string; // ISO
    /** Captura manual al caer en Monitoreo: no viene de catálogo en FWD. */
    operadorManual: string;
    medioComunicacion: string;
    unidadManual: string;
    placaManual: string;
    /** Manuales en ambos: no se infieren de nada más. */
    observaciones: string;
    cuentaEspejo: string;
    referencia: string;
    /** Bitácora de hitos del tramo, cada uno vacío hasta que se captura. */
    salidaPatio: string; // datetime-local
    arriboCarga: string;
    ingresoCargar: string;
    inicioRuta: string;
    arriboDestino: string;
    ingresoDescarga: string;
    servicioFinalizado: string;
  };

  notas?: string;
};

/** Un archivo del expediente digital, guardado como data URL (base64). */
export type DocumentoUnidad = { nombre: string; datos: string };

export type Unidad = {
  id: string;
  economico: string;
  placas: string;
  tipo: string;
  capacidadTon: number;
  estado: EstadoUnidad;
  activo: boolean;
  // Expediente de Flota.
  marca: string;
  modelo: string;
  anio: number | null;
  vin: string;
  color: string;
  polizaSeguro: string;
  vencimientoSeguro: string | null;
  verificacionVigente: boolean;
  verificacionVencimiento: string | null;
  /** Fotografías como data URL (base64): solución de modo de prueba. */
  fotos: string[];
  documentos: DocumentoUnidad[];
};

export type Operador = {
  id: string;
  nombre: string;
  licencia: string;
  celular: string;
  rfc: string;
  contactoEmergencia: string;
  /** Número de seguridad social (IMSS). */
  nss: string;
  estado: EstadoOperador;
  activo: boolean;
};

/** Tarifa de venta por cliente y tramo (Ventas › Tarifas). */
export type Tarifa = {
  id: string;
  clienteId: string;
  /** Nombre del cliente, resuelto por el backend para listar sin cruzar. */
  cliente: string;
  origen: string;
  destino: string;
  tarifaVenta: number;
  activo: boolean;
};

/** Usuario del TMS, tal como lo administra el panel de Administración. */
export type RolUsuario = "admin" | "manager" | "dispatcher" | "accountant" | "driver";

export const ROLES_USUARIO: { value: RolUsuario; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "manager", label: "Gerencia" },
  { value: "dispatcher", label: "Tráfico" },
  { value: "accountant", label: "Contabilidad" },
  { value: "driver", label: "Operador" },
];

export type Usuario = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: RolUsuario;
  isActive: boolean;
  mfaEnabled: boolean;
  bloqueado: boolean;
  ultimoAcceso: string | null;
  createdAt: string | null;
};

/** Ruta frecuente: código, tramo y sus proyecciones de km y casetas. */
export type Ruta = {
  id: string;
  codigo: string;
  origen: string;
  destino: string;
  kmProyectados: number;
  casetasProyectadas: number;
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
  { value: "por_asignar", label: "Por asignar" },
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
  por_asignar: "bg-orange-50 text-orange-700 ring-orange-200 ring-dashed",
  programado: "bg-slate-100 text-slate-700 ring-slate-200",
  en_ruta_ida: "bg-blue-50 text-blue-700 ring-blue-200",
  en_destino: "bg-violet-50 text-violet-700 ring-violet-200",
  en_ruta_vuelta: "bg-amber-50 text-amber-800 ring-amber-200",
  completado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelado: "bg-rose-50 text-rose-700 ring-rose-200",
};

/**
 * Semáforo de Monitoreo: verde = en curso o cerrado bien, amarillo = aún no
 * sale, rojo = cancelado. No mide retraso contra la cita porque hoy no hay
 * un dato de "hora comprometida" contra el que compararlo; es un semáforo
 * de avance, no de puntualidad.
 */
export type Semaforo = "verde" | "amarillo" | "rojo";

export const ESTADO_SEMAFORO: Record<EstadoViaje, Semaforo> = {
  por_asignar: "rojo",
  programado: "amarillo",
  en_ruta_ida: "verde",
  en_destino: "verde",
  en_ruta_vuelta: "verde",
  completado: "verde",
  cancelado: "rojo",
};

export const SEMAFORO_CLASS: Record<Semaforo, string> = {
  verde: "bg-emerald-500",
  amarillo: "bg-amber-400",
  rojo: "bg-rose-500",
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

/**
 * Rentabilidad en porcentaje sobre la venta. Sin tarifa registrada no hay
 * porcentaje que calcular —dividir entre cero— y devuelve null para que la
 * pantalla lo muestre como "sin tarifa" en vez de 0%.
 */
export function rentabilidad(v: Viaje): number | null {
  if (!v.tarifa) return null;
  return (margen(v) / v.tarifa) * 100;
}

/** En round trip la unidad regresa al origen; en one way, no. */
export function rutaTexto(v: Viaje): string {
  return v.modalidad === "RT"
    ? `${v.origen} → ${v.destino} → ${v.origen}`
    : `${v.origen} → ${v.destino}`;
}

/**
 * Disponibilidad de flota y personal.
 *
 * El backend usa el vocabulario del catálogo (`operativo`, `activo`) y el modo
 * demostración el de la operación (`disponible`). Ambos significan lo mismo, y
 * dar por bueno uno solo hacía que el tablero reportara cero unidades libres
 * teniendo la flota entera parada en el patio.
 */
export function unidadDisponible(u: Unidad): boolean {
  return u.activo && (u.estado === "operativo" || u.estado === "disponible");
}

export function operadorDisponible(o: Operador): boolean {
  return o.activo && (o.estado === "activo" || o.estado === "disponible");
}

/**
 * Un servicio "por asignar" solo pasa a Monitoreo cuando alguien completó su
 * asignación (unidad+operador en TDC, proveedor en FWD) y le dio "Programar
 * Servicio". Esto decide si ese botón se habilita.
 */
export function listoParaProgramar(v: Viaje): boolean {
  if (v.estado !== "por_asignar") return false;
  return v.asignacion === "TDC"
    ? Boolean(v.unidadId && v.operadorId)
    : Boolean(v.proveedorId);
}

/** Hitos del tramo en Monitoreo, en el orden en que ocurren. */
export const HITOS_MONITOREO: { clave: keyof Viaje["monitoreo"]; titulo: string }[] = [
  { clave: "salidaPatio", titulo: "Salida de patio" },
  { clave: "arriboCarga", titulo: "Arribo a carga" },
  { clave: "ingresoCargar", titulo: "Ingreso a cargar" },
  { clave: "inicioRuta", titulo: "Inicio de ruta" },
  { clave: "arriboDestino", titulo: "Arribo a destino" },
  { clave: "ingresoDescarga", titulo: "Ingreso a descarga" },
  { clave: "servicioFinalizado", titulo: "Servicio finalizado" },
];

/**
 * Alerta de vigencia para el expediente de Flota: rojo si ya venció, ámbar
 * si vence en 30 días o menos. Vinculado con Mantenimiento: es la señal que
 * ese módulo va a consumir cuando exista.
 */
export function alertaVigencia(fecha: string | null): Semaforo | null {
  if (!fecha) return null;
  const dias = (new Date(`${fecha}T00:00:00Z`).getTime() - Date.now()) / 86_400_000;
  if (dias < 0) return "rojo";
  if (dias <= 30) return "amarillo";
  return null;
}

/** Fecha de referencia del servicio para ordenar y agrupar. */
export function fechaServicio(v: Viaje): string {
  return v.citaCarga.slice(0, 10);
}

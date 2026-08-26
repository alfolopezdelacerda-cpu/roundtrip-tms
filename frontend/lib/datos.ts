import { hayApi, peticion } from "./api";
import {
  clientesSeed,
  puertosSeed,
  tiposIncidenciaSeed,
  tiposMercanciaSeed,
  tiposNegocioSeed,
  tiposUnidadSeed,
  type ClaveCatalogo,
} from "./catalogos";
import {
  operadoresSeed,
  proveedoresSeed,
  rutasSeed,
  tarifasSeed,
  unidadesSeed,
  viajesSeed,
} from "./seed";
import type { EstadoViaje, RolUsuario, Usuario, Viaje } from "./types";

/**
 * Origen de los datos.
 *
 * Hay dos implementaciones tras la misma interfaz:
 *
 * - **api**: habla con el backend NestJS. Es el modo real.
 * - **demo**: datos de ejemplo en `localStorage`. Se usa cuando no hay
 *   `NEXT_PUBLIC_API_URL` configurada, que es el caso del despliegue público
 *   de Vercel: sin backend hospedado, la alternativa sería una pantalla de
 *   error, y para mostrar el sistema conviene que siga navegable.
 *
 * El modo se anuncia en la interfaz para que nadie confunda un dato de
 * ejemplo con uno real.
 */

export type Modo = "api" | "demo";

export type Datos = {
  viajes: Viaje[];
  clientes: RegistroCatalogo[];
  proveedores: RegistroCatalogo[];
  unidades: RegistroCatalogo[];
  operadores: RegistroCatalogo[];
  puertos: RegistroCatalogo[];
  tiposNegocio: RegistroCatalogo[];
  tiposUnidad: RegistroCatalogo[];
  tiposMercancia: RegistroCatalogo[];
  rutas: RegistroCatalogo[];
  tarifas: RegistroCatalogo[];
  tiposIncidencia: RegistroCatalogo[];
};

export type RegistroCatalogo = {
  id: string;
  activo: boolean;
} & Record<string, unknown>;

export type ResultadoBorrado = { desactivado: boolean; usos: number };

/** Lo que se completa en Asignación TDC/FWD antes de "Programar Servicio". */
export type DatosAsignacion = {
  unidadId?: string;
  operadorId?: string;
  proveedorId?: string;
  /** Solo TDC: al fijarla, el backend copia km y casetas de la ruta. */
  rutaId?: string;
  km?: number;
  /** Solo FWD: lo que cobra el proveedor. La tarifa sale del tarifario. */
  costoProveedor?: number;
};

/**
 * Desglose del costo operativo (Finanzas › Rentabilidad por viaje). El total
 * no se manda: el backend lo recalcula sumando las partes.
 */
export type DatosCostos = {
  costoProveedor?: number;
  costoCombustible?: number;
  costoCasetas?: number;
  costoOperador?: number;
  costoOtros?: number;
};

/** Incidencia reportada a un operador desde Monitoreo. */
export type IncidenciaViaje = {
  id: string;
  conductorId: string | null;
  operador: string;
  tipoId: string;
  tipo: string;
  servicioId: string | null;
  folio: string | null;
  descripcion: string | null;
  creadoPor: string | null;
  createdAt: string;
};

export type NuevaIncidencia = {
  conductorId?: string;
  operadorNombre?: string;
  tipoId: string;
  servicioId?: string;
  descripcion?: string;
};

/** Cierre operativo de la liquidación: gastos de la unidad en el tramo. */
export type DatosLiquidacion = {
  combustible?: number;
  casetas?: number;
  gastosExtra?: number;
  gastosExtraDetalle?: string;
  evidencias?: boolean;
};

/** Captura manual en el tablero de Monitoreo. */
export type DatosMonitoreoManual = {
  operadorManual?: string;
  medioComunicacion?: string;
  unidadManual?: string;
  placaManual?: string;
  ubicacion?: string;
  observaciones?: string;
  cuentaEspejo?: string;
  referencia?: string;
  /** Hitos en formato datetime-local; cadena vacía limpia el hito. */
  salidaPatio?: string;
  arriboCarga?: string;
  ingresoCargar?: string;
  inicioRuta?: string;
  arriboDestino?: string;
  ingresoDescarga?: string;
  servicioFinalizado?: string;
};

/** Claves de hitos, para convertir en bloque entre ISO y datetime-local. */
const HITOS = [
  "salidaPatio",
  "arriboCarga",
  "ingresoCargar",
  "inicioRuta",
  "arriboDestino",
  "ingresoDescarga",
  "servicioFinalizado",
] as const;

export type FuenteDatos = {
  modo: Modo;
  cargar: () => Promise<Datos>;
  crearViaje: (v: Omit<Viaje, "id" | "folio" | "cartaPorte">) => Promise<Viaje>;
  asignar: (id: string, datos: DatosAsignacion) => Promise<Viaje>;
  actualizarCostos: (id: string, datos: DatosCostos) => Promise<Viaje>;
  actualizarMonitoreo: (id: string, datos: DatosMonitoreoManual) => Promise<Viaje>;
  cambiarEstado: (id: string, estado: EstadoViaje) => Promise<Viaje>;
  facturar: (id: string, factura: string, fechaFactura: string) => Promise<Viaje>;
  marcarCobrado: (id: string) => Promise<Viaje>;
  autorizarPago: (id: string) => Promise<Viaje>;
  marcarPagado: (id: string, referencia: string) => Promise<Viaje>;
  liquidar: (id: string, datos: DatosLiquidacion) => Promise<Viaje>;
  crearCatalogo: (clave: ClaveCatalogo, item: Record<string, unknown>) => Promise<Datos>;
  actualizarCatalogo: (
    clave: ClaveCatalogo,
    id: string,
    cambios: Record<string, unknown>,
  ) => Promise<Datos>;
  eliminarCatalogo: (clave: ClaveCatalogo, id: string) => Promise<ResultadoBorrado>;

  // --- Incidencias (Seguridad) ---
  listarIncidencias: (filtro?: {
    conductorId?: string;
    servicioId?: string;
  }) => Promise<IncidenciaViaje[]>;
  crearIncidencia: (datos: NuevaIncidencia) => Promise<IncidenciaViaje>;

  // --- Administración de usuarios (solo modo API: la demo no tiene sesión) ---
  listarUsuarios: () => Promise<Usuario[]>;
  permisosPorRol: () => Promise<Record<RolUsuario, string[]>>;
  crearUsuario: (datos: NuevoUsuario) => Promise<Usuario>;
  actualizarUsuario: (id: string, cambios: CambiosUsuario) => Promise<Usuario>;
  cambiarPasswordUsuario: (id: string, password: string) => Promise<void>;
  eliminarUsuario: (id: string) => Promise<void>;
};

export type NuevoUsuario = {
  email: string;
  username: string;
  password: string;
  role: RolUsuario;
  firstName?: string;
  lastName?: string;
};

export type CambiosUsuario = Partial<
  Pick<Usuario, "email" | "username" | "role" | "firstName" | "lastName" | "isActive">
>;

/** Nombre del catálogo en la API (kebab-case) para cada clave del frontend. */
const RUTA_CATALOGO: Record<ClaveCatalogo, string> = {
  clientes: "clientes",
  proveedores: "proveedores",
  unidades: "unidades",
  operadores: "operadores",
  puertos: "puertos",
  tiposNegocio: "tipos-negocio",
  tiposUnidad: "tipos-unidad",
  tiposMercancia: "tipos-mercancia",
  rutas: "rutas",
  tarifas: "tarifas",
  tiposIncidencia: "tipos-incidencia",
};

const CLAVES = Object.keys(RUTA_CATALOGO) as ClaveCatalogo[];

// ============================================
// Fuente: API
// ============================================

/** Lo que devuelve el backend por servicio. */
type ServicioApi = Omit<Viaje, "notas"> & { notas: string | null };

function fuenteApi(): FuenteDatos {
  const traerCatalogos = async () => {
    const listas = await Promise.all(
      CLAVES.map((clave) =>
        peticion<RegistroCatalogo[]>(`/api/v1/catalogos/${RUTA_CATALOGO[clave]}`),
      ),
    );
    return Object.fromEntries(
      CLAVES.map((clave, i) => [clave, listas[i]]),
    ) as Omit<Datos, "viajes">;
  };

  const cargar = async (): Promise<Datos> => {
    const [viajes, catalogos] = await Promise.all([
      peticion<ServicioApi[]>("/api/v1/servicios"),
      traerCatalogos(),
    ]);
    return { ...catalogos, viajes: viajes.map(deApi) };
  };

  /** Tras tocar un catálogo se recarga todo: son listas cortas. */
  const recargarCatalogos = async (): Promise<Datos> => ({
    ...(await traerCatalogos()),
    viajes: await peticion<ServicioApi[]>("/api/v1/servicios").then((v) => v.map(deApi)),
  });

  const accion = (id: string, ruta: string, cuerpo?: unknown) =>
    peticion<ServicioApi>(`/api/v1/servicios/${id}/${ruta}`, {
      metodo: "POST",
      cuerpo,
    }).then(deApi);

  return {
    modo: "api",
    cargar,

    crearViaje: (v) =>
      peticion<ServicioApi>("/api/v1/servicios", {
        metodo: "POST",
        cuerpo: aApi(v),
      }).then(deApi),

    asignar: (id, datos) =>
      peticion<ServicioApi>(`/api/v1/servicios/${id}`, {
        metodo: "PATCH",
        cuerpo: datos,
      }).then(deApi),

    actualizarCostos: (id, datos) =>
      peticion<ServicioApi>(`/api/v1/servicios/${id}/costos`, {
        metodo: "PATCH",
        cuerpo: datos,
      }).then(deApi),

    actualizarMonitoreo: (id, datos) =>
      peticion<ServicioApi>(`/api/v1/servicios/${id}/monitoreo`, {
        metodo: "PATCH",
        cuerpo: aApiMonitoreo(datos),
      }).then(deApi),

    cambiarEstado: (id, estado) => accion(id, "estado", { estado }),
    facturar: (id, factura, fechaFactura) =>
      accion(id, "facturar", { factura, fechaFactura }),
    marcarCobrado: (id) => accion(id, "cobrar"),
    autorizarPago: (id) => accion(id, "autorizar-pago"),
    marcarPagado: (id, referencia) => accion(id, "pagar", { referencia }),
    liquidar: (id, datos) => accion(id, "liquidar", datos),

    crearCatalogo: async (clave, item) => {
      await peticion(`/api/v1/catalogos/${RUTA_CATALOGO[clave]}`, {
        metodo: "POST",
        cuerpo: item,
      });
      return recargarCatalogos();
    },

    actualizarCatalogo: async (clave, id, cambios) => {
      await peticion(`/api/v1/catalogos/${RUTA_CATALOGO[clave]}/${id}`, {
        metodo: "PATCH",
        cuerpo: cambios,
      });
      return recargarCatalogos();
    },

    eliminarCatalogo: async (clave, id) => {
      const usos = await peticion<{ usos: number }>(
        `/api/v1/catalogos/${RUTA_CATALOGO[clave]}/${id}/usos`,
      );
      try {
        await peticion(`/api/v1/catalogos/${RUTA_CATALOGO[clave]}/${id}`, {
          metodo: "DELETE",
        });
        return { desactivado: false, usos: 0 };
      } catch (error) {
        // 409 con `desactivado`: el registro estaba en uso y se dio de baja.
        const detalle = (error as { detalle?: { desactivado?: boolean } }).detalle;
        if (detalle?.desactivado) return { desactivado: true, usos: usos.usos };
        throw error;
      }
    },

    listarIncidencias: (filtro) => {
      const qs = new URLSearchParams(
        Object.entries(filtro ?? {}).filter(([, v]) => v) as [string, string][],
      ).toString();
      return peticion<IncidenciaViaje[]>(`/api/v1/incidencias${qs ? `?${qs}` : ""}`);
    },
    crearIncidencia: (datos) =>
      peticion<IncidenciaViaje>("/api/v1/incidencias", { metodo: "POST", cuerpo: datos }),

    listarUsuarios: () => peticion<Usuario[]>("/api/v1/usuarios"),
    permisosPorRol: () =>
      peticion<Record<RolUsuario, string[]>>("/api/v1/usuarios/permisos"),
    crearUsuario: (datos) =>
      peticion<Usuario>("/api/v1/usuarios", { metodo: "POST", cuerpo: datos }),
    actualizarUsuario: (id, cambios) =>
      peticion<Usuario>(`/api/v1/usuarios/${id}`, { metodo: "PATCH", cuerpo: cambios }),
    cambiarPasswordUsuario: async (id, password) => {
      await peticion(`/api/v1/usuarios/${id}/password`, {
        metodo: "POST",
        cuerpo: { password },
      });
    },
    eliminarUsuario: async (id) => {
      await peticion(`/api/v1/usuarios/${id}`, { metodo: "DELETE" });
    },
  };
}

/**
 * La API devuelve fechas ISO en UTC; la aplicación trabaja con la hora local
 * de la cita, que es la que el cliente confirmó. Se convierte al formato que
 * entienden los `datetime-local` y `fechaHora()`.
 */
function aLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}`
  );
}

function deApi(s: ServicioApi): Viaje {
  const monitoreo = { ...s.monitoreo, actualizado: s.monitoreo.actualizado ?? new Date().toISOString() };
  const hitos = monitoreo as unknown as Record<string, string | null>;
  for (const clave of HITOS) {
    hitos[clave] = aLocal(hitos[clave]);
  }
  return {
    ...s,
    citaCarga: aLocal(s.citaCarga),
    citaDescarga: aLocal(s.citaDescarga),
    notas: s.notas ?? undefined,
    monitoreo,
  };
}

/**
 * Aplica un cambio parcial al desglose de costos y recalcula el total, igual
 * que hace el backend: `costo` nunca se captura, siempre es la suma.
 */
function conCostos(
  v: Viaje,
  cambios: Partial<Viaje["costos"]>,
): Pick<Viaje, "costos" | "costo"> {
  const costos = { ...v.costos, ...cambios };
  const costo = Object.values(costos).reduce((suma, parte) => suma + (parte || 0), 0);
  return { costos, costo };
}

/**
 * Tarifa de venta del tramo según el tarifario. Compara sin distinguir
 * mayúsculas ni espacios sobrantes porque origen y destino se escriben a
 * mano en el alta.
 */
function tarifaDeVenta(
  tarifas: RegistroCatalogo[],
  clienteId: string,
  origen: string,
  destino: string,
): number {
  const normalizar = (s: string) => s.trim().toLowerCase();
  const encontrada = tarifas.find(
    (t) =>
      t.activo &&
      t.clienteId === clienteId &&
      normalizar(String(t.origen ?? "")) === normalizar(origen) &&
      normalizar(String(t.destino ?? "")) === normalizar(destino),
  );
  return encontrada ? Number(encontrada.tarifaVenta ?? 0) : 0;
}

/** Los hitos viajan en datetime-local; la API los quiere en ISO (o null). */
function aApiMonitoreo(datos: DatosMonitoreoManual): Record<string, unknown> {
  const cuerpo: Record<string, unknown> = { ...datos };
  for (const clave of HITOS) {
    const valor = datos[clave];
    if (valor !== undefined) cuerpo[clave] = valor ? new Date(valor).toISOString() : "";
  }
  return cuerpo;
}

/** El alta manda solo lo que el backend acepta; folio y carta porte los pone él. */
function aApi(v: Omit<Viaje, "id" | "folio" | "cartaPorte">): Record<string, unknown> {
  return {
    clienteId: v.clienteId,
    origen: v.origen,
    destino: v.destino,
    puertoId: v.puertoId,
    citaCarga: new Date(v.citaCarga).toISOString(),
    citaDescarga: new Date(v.citaDescarga || v.citaCarga).toISOString(),
    asignacion: v.asignacion,
    ...(v.unidadId ? { unidadId: v.unidadId } : {}),
    ...(v.operadorId ? { operadorId: v.operadorId } : {}),
    ...(v.proveedorId ? { proveedorId: v.proveedorId } : {}),
    ...(v.tipoNegocioId ? { tipoNegocioId: v.tipoNegocioId } : {}),
    ...(v.tipoUnidadId ? { tipoUnidadId: v.tipoUnidadId } : {}),
    ...(v.tipoMercanciaId ? { tipoMercanciaId: v.tipoMercanciaId } : {}),
    temperatura: v.temperatura,
    modalidad: v.modalidad,
    contenedor1: v.contenedor1,
    contenedor2: v.contenedor2,
    booking: v.booking,
    po: v.po,
    estado: v.estado,
    km: v.km,
    // La tarifa no se manda: el backend la resuelve del tarifario de Ventas.
    costo: v.costo,
    diasCredito: v.cobro.diasCredito,
    ...(v.notas ? { notas: v.notas } : {}),
  };
}

// ============================================
// Fuente: demostración
// ============================================

const CLAVE_DEMO = "roundtrip-tms:v7";
const CLAVE_DEMO_INCIDENCIAS = "roundtrip-tms:incidencias";

function leerIncidenciasDemo(): IncidenciaViaje[] {
  try {
    const raw = window.localStorage.getItem(CLAVE_DEMO_INCIDENCIAS);
    return raw ? (JSON.parse(raw) as IncidenciaViaje[]) : [];
  } catch {
    return [];
  }
}

function guardarIncidenciasDemo(lista: IncidenciaViaje[]) {
  try {
    window.localStorage.setItem(CLAVE_DEMO_INCIDENCIAS, JSON.stringify(lista));
  } catch {
    // ignorar cuota / modo privado
  }
}

function fuenteDemo(): FuenteDatos {
  const inicial = (): Datos => ({
    viajes: viajesSeed,
    clientes: clientesSeed as unknown as RegistroCatalogo[],
    proveedores: proveedoresSeed as unknown as RegistroCatalogo[],
    unidades: unidadesSeed as unknown as RegistroCatalogo[],
    operadores: operadoresSeed as unknown as RegistroCatalogo[],
    puertos: puertosSeed as unknown as RegistroCatalogo[],
    tiposNegocio: tiposNegocioSeed as unknown as RegistroCatalogo[],
    tiposUnidad: tiposUnidadSeed as unknown as RegistroCatalogo[],
    tiposMercancia: tiposMercanciaSeed as unknown as RegistroCatalogo[],
    rutas: rutasSeed as unknown as RegistroCatalogo[],
    tarifas: tarifasSeed as unknown as RegistroCatalogo[],
    tiposIncidencia: tiposIncidenciaSeed as unknown as RegistroCatalogo[],
  });

  let datos: Datos = inicial();

  const leer = (): Datos => {
    try {
      const raw = window.localStorage.getItem(CLAVE_DEMO);
      if (raw) return { ...inicial(), ...(JSON.parse(raw) as Partial<Datos>) };
    } catch {
      // sin almacenamiento: se sigue con los datos de ejemplo
    }
    return inicial();
  };

  const guardar = () => {
    try {
      window.localStorage.setItem(CLAVE_DEMO, JSON.stringify(datos));
    } catch {
      // ignorar cuota / modo privado
    }
  };

  const editar = (id: string, cambio: (v: Viaje) => Viaje): Viaje => {
    const actualizado = cambio(datos.viajes.find((v) => v.id === id)!);
    datos = {
      ...datos,
      viajes: datos.viajes.map((v) => (v.id === id ? actualizado : v)),
    };
    guardar();
    return actualizado;
  };

  const hoy = () => new Date().toISOString().slice(0, 10);

  return {
    modo: "demo",

    cargar: async () => {
      datos = leer();
      return datos;
    },

    crearViaje: async (v) => {
      const consecutivo =
        datos.viajes.reduce((m, x) => {
          const n = Number(x.folio.replace(/\D/g, ""));
          return Number.isFinite(n) && n > m ? n : m;
        }, 2600) + 1;

      const creado: Viaje = {
        ...v,
        id: `v${Date.now()}`,
        folio: `RT-${consecutivo}`,
        cartaPorte: `CP-${new Date().getFullYear()}-${consecutivo}`,
        // Espeja al backend: la tarifa sale del tarifario de Ventas, no del alta.
        tarifa: tarifaDeVenta(datos.tarifas, v.clienteId, v.origen, v.destino),
      };
      datos = { ...datos, viajes: [creado, ...datos.viajes] };
      guardar();
      return creado;
    },

    asignar: async (id, cambios) =>
      editar(id, (v) => {
        // Espeja al backend: elegir ruta copia km y casetas proyectados.
        const rutaElegida =
          cambios.rutaId !== undefined
            ? (datos.rutas.find((r) => r.id === cambios.rutaId) as unknown as
                | { codigo: string; kmProyectados: number; casetasProyectadas: number }
                | undefined)
            : undefined;
        return {
          ...v,
          ...(cambios.unidadId !== undefined ? { unidadId: cambios.unidadId } : {}),
          ...(cambios.operadorId !== undefined ? { operadorId: cambios.operadorId } : {}),
          ...(cambios.proveedorId !== undefined ? { proveedorId: cambios.proveedorId } : {}),
          ...(cambios.rutaId !== undefined
            ? {
                rutaId: cambios.rutaId,
                rutaCodigo: rutaElegida?.codigo ?? "",
                km: rutaElegida?.kmProyectados ?? 0,
                casetasProyectadas: rutaElegida?.casetasProyectadas ?? 0,
              }
            : {}),
          ...(cambios.km !== undefined ? { km: cambios.km } : {}),
          ...(cambios.costoProveedor !== undefined
            ? conCostos(v, { proveedor: cambios.costoProveedor })
            : {}),
        };
      }),

    actualizarCostos: async (id, cambios) =>
      editar(id, (v) =>
        ({
          ...v,
          ...conCostos(v, {
            ...(cambios.costoProveedor !== undefined
              ? { proveedor: cambios.costoProveedor }
              : {}),
            ...(cambios.costoCombustible !== undefined
              ? { combustible: cambios.costoCombustible }
              : {}),
            ...(cambios.costoCasetas !== undefined ? { casetas: cambios.costoCasetas } : {}),
            ...(cambios.costoOperador !== undefined
              ? { operador: cambios.costoOperador }
              : {}),
            ...(cambios.costoOtros !== undefined ? { otros: cambios.costoOtros } : {}),
          }),
        }) as Viaje,
      ),

    actualizarMonitoreo: async (id, datos) =>
      editar(id, (v) => {
        const cambios = Object.fromEntries(
          Object.entries(datos).filter(([, valor]) => valor !== undefined),
        );
        return {
          ...v,
          monitoreo: {
            ...v.monitoreo,
            ...cambios,
            actualizado: new Date().toISOString(),
          },
        };
      }),

    cambiarEstado: async (id, estado) =>
      editar(id, (v) => ({
        ...v,
        estado,
        monitoreo: {
          ...v.monitoreo,
          avance: estado === "completado" ? 100 : v.monitoreo.avance,
          actualizado: new Date().toISOString(),
        },
      })),

    facturar: async (id, factura, fechaFactura) =>
      editar(id, (v) => ({
        ...v,
        cobro: { ...v.cobro, estado: "facturado", factura, fechaFactura },
      })),

    marcarCobrado: async (id) =>
      editar(id, (v) => ({ ...v, cobro: { ...v.cobro, estado: "cobrado" } })),

    autorizarPago: async (id) =>
      editar(id, (v) => ({ ...v, pago: { ...v.pago, estado: "autorizado" } })),

    marcarPagado: async (id, referencia) =>
      editar(id, (v) => ({
        ...v,
        pago: { estado: "pagado", referencia, fechaPago: hoy() },
      })),

    liquidar: async (id, datos) =>
      editar(id, (v) => ({
        ...v,
        liquidacion: {
          estado: "liquidado",
          fecha: hoy(),
          combustible: datos.combustible ?? 0,
          casetas: datos.casetas ?? 0,
          gastosExtra: datos.gastosExtra ?? 0,
          gastosExtraDetalle: datos.gastosExtraDetalle || null,
          evidencias: datos.evidencias ?? false,
        },
      })),

    crearCatalogo: async (clave, item) => {
      const lista = datos[clave];
      datos = {
        ...datos,
        [clave]: [
          ...lista,
          { ...item, id: `${clave.slice(0, 2)}${Date.now()}`, activo: true },
        ],
      };
      guardar();
      return datos;
    },

    actualizarCatalogo: async (clave, id, cambios) => {
      datos = {
        ...datos,
        [clave]: datos[clave].map((i) => (i.id === id ? { ...i, ...cambios } : i)),
      };
      guardar();
      return datos;
    },

    eliminarCatalogo: async (clave, id) => {
      const campo = CAMPO_EN_VIAJE[clave];
      const usos = datos.viajes.filter((v) => v[campo] === id).length;

      if (usos > 0) {
        datos = {
          ...datos,
          [clave]: datos[clave].map((i) =>
            i.id === id ? { ...i, activo: false } : i,
          ),
        };
        guardar();
        return { desactivado: true, usos };
      }

      datos = { ...datos, [clave]: datos[clave].filter((i) => i.id !== id) };
      guardar();
      return { desactivado: false, usos: 0 };
    },

    listarIncidencias: async (filtro) => {
      let lista = leerIncidenciasDemo();
      if (filtro?.conductorId) {
        lista = lista.filter((i) => i.conductorId === filtro.conductorId);
      }
      if (filtro?.servicioId) {
        lista = lista.filter((i) => i.servicioId === filtro.servicioId);
      }
      return lista;
    },
    crearIncidencia: async (nueva) => {
      const tipo = datos.tiposIncidencia.find((t) => t.id === nueva.tipoId);
      const servicio = nueva.servicioId
        ? datos.viajes.find((v) => v.id === nueva.servicioId)
        : undefined;
      const incidencia: IncidenciaViaje = {
        id: crypto.randomUUID(),
        conductorId: nueva.conductorId ?? null,
        operador: nueva.operadorNombre ?? "",
        tipoId: nueva.tipoId,
        tipo: (tipo?.nombre as string) ?? "",
        servicioId: nueva.servicioId ?? null,
        folio: servicio?.folio ?? null,
        descripcion: nueva.descripcion ?? null,
        creadoPor: "demo",
        createdAt: new Date().toISOString(),
      };
      const lista = [incidencia, ...leerIncidenciasDemo()];
      guardarIncidenciasDemo(lista);
      return incidencia;
    },

    // La demostración corre sin sesión ni backend: no hay usuarios que
    // administrar, y fingirlos daría una falsa sensación de control.
    listarUsuarios: async () => [],
    permisosPorRol: async () => ({}) as Record<RolUsuario, string[]>,
    crearUsuario: sinUsuariosEnDemo,
    actualizarUsuario: sinUsuariosEnDemo,
    cambiarPasswordUsuario: sinUsuariosEnDemo,
    eliminarUsuario: sinUsuariosEnDemo,
  };
}

/** Cualquier escritura sobre usuarios en modo demostración. */
function sinUsuariosEnDemo(): never {
  throw new Error(
    "La administración de usuarios necesita el backend; el modo demostración no tiene sesión.",
  );
}

/** Campo del viaje que apunta a cada catálogo (para contar usos en demo). */
const CAMPO_EN_VIAJE: Record<ClaveCatalogo, keyof Viaje> = {
  clientes: "clienteId",
  proveedores: "proveedorId",
  unidades: "unidadId",
  operadores: "operadorId",
  puertos: "puertoId",
  tiposNegocio: "tipoNegocioId",
  tiposUnidad: "tipoUnidadId",
  tiposMercancia: "tipoMercanciaId",
  rutas: "rutaId",
  // El servicio no guarda de qué tarifa salió su importe: lo copia al alta.
  // Sin columna que consultar, una tarifa nunca cuenta como "en uso".
  tarifas: "id",
  // Las incidencias no viven en el servicio: nunca hay "usos" que impidan
  // borrar un tipo de incidencia.
  tiposIncidencia: "id",
};

export function crearFuente(): FuenteDatos {
  return hayApi ? fuenteApi() : fuenteDemo();
}

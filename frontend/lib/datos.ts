import { hayApi, peticion } from "./api";
import {
  clientesSeed,
  puertosSeed,
  tiposMercanciaSeed,
  tiposNegocioSeed,
  tiposUnidadSeed,
  type ClaveCatalogo,
} from "./catalogos";
import { operadoresSeed, proveedoresSeed, unidadesSeed, viajesSeed } from "./seed";
import type { EstadoViaje, Viaje } from "./types";

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
  km?: number;
  tarifa?: number;
  costo?: number;
};

/** Captura manual al caer en Monitoreo: no viene de catálogo. */
export type DatosMonitoreoManual = {
  operadorManual?: string;
  medioComunicacion?: string;
  unidadManual?: string;
  placaManual?: string;
};

export type FuenteDatos = {
  modo: Modo;
  cargar: () => Promise<Datos>;
  crearViaje: (v: Omit<Viaje, "id" | "folio" | "cartaPorte">) => Promise<Viaje>;
  asignar: (id: string, datos: DatosAsignacion) => Promise<Viaje>;
  actualizarMonitoreo: (id: string, datos: DatosMonitoreoManual) => Promise<Viaje>;
  cambiarEstado: (id: string, estado: EstadoViaje) => Promise<Viaje>;
  facturar: (id: string, factura: string, fechaFactura: string) => Promise<Viaje>;
  marcarCobrado: (id: string) => Promise<Viaje>;
  autorizarPago: (id: string) => Promise<Viaje>;
  marcarPagado: (id: string, referencia: string) => Promise<Viaje>;
  liquidar: (id: string) => Promise<Viaje>;
  crearCatalogo: (clave: ClaveCatalogo, item: Record<string, unknown>) => Promise<Datos>;
  actualizarCatalogo: (
    clave: ClaveCatalogo,
    id: string,
    cambios: Record<string, unknown>,
  ) => Promise<Datos>;
  eliminarCatalogo: (clave: ClaveCatalogo, id: string) => Promise<ResultadoBorrado>;
};

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

    actualizarMonitoreo: (id, datos) =>
      peticion<ServicioApi>(`/api/v1/servicios/${id}/monitoreo`, {
        metodo: "PATCH",
        cuerpo: datos,
      }).then(deApi),

    cambiarEstado: (id, estado) => accion(id, "estado", { estado }),
    facturar: (id, factura, fechaFactura) =>
      accion(id, "facturar", { factura, fechaFactura }),
    marcarCobrado: (id) => accion(id, "cobrar"),
    autorizarPago: (id) => accion(id, "autorizar-pago"),
    marcarPagado: (id, referencia) => accion(id, "pagar", { referencia }),
    liquidar: (id) => accion(id, "liquidar"),

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
  return {
    ...s,
    citaCarga: aLocal(s.citaCarga),
    citaDescarga: aLocal(s.citaDescarga),
    notas: s.notas ?? undefined,
    monitoreo: {
      ...s.monitoreo,
      actualizado: s.monitoreo.actualizado ?? new Date().toISOString(),
    },
  };
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
    tarifa: v.tarifa,
    costo: v.costo,
    diasCredito: v.cobro.diasCredito,
    ...(v.notas ? { notas: v.notas } : {}),
  };
}

// ============================================
// Fuente: demostración
// ============================================

const CLAVE_DEMO = "roundtrip-tms:v5";

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
      };
      datos = { ...datos, viajes: [creado, ...datos.viajes] };
      guardar();
      return creado;
    },

    asignar: async (id, datos) =>
      editar(id, (v) => ({
        ...v,
        ...(datos.unidadId !== undefined ? { unidadId: datos.unidadId } : {}),
        ...(datos.operadorId !== undefined ? { operadorId: datos.operadorId } : {}),
        ...(datos.proveedorId !== undefined ? { proveedorId: datos.proveedorId } : {}),
        ...(datos.km !== undefined ? { km: datos.km } : {}),
        ...(datos.tarifa !== undefined ? { tarifa: datos.tarifa } : {}),
        ...(datos.costo !== undefined ? { costo: datos.costo } : {}),
      })),

    actualizarMonitoreo: async (id, datos) =>
      editar(id, (v) => ({
        ...v,
        monitoreo: {
          ...v.monitoreo,
          ...(datos.operadorManual !== undefined
            ? { operadorManual: datos.operadorManual }
            : {}),
          ...(datos.medioComunicacion !== undefined
            ? { medioComunicacion: datos.medioComunicacion }
            : {}),
          ...(datos.unidadManual !== undefined ? { unidadManual: datos.unidadManual } : {}),
          ...(datos.placaManual !== undefined ? { placaManual: datos.placaManual } : {}),
          actualizado: new Date().toISOString(),
        },
      })),

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

    liquidar: async (id) =>
      editar(id, (v) => ({
        ...v,
        liquidacion: { estado: "liquidado", fecha: hoy() },
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
  };
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
};

export function crearFuente(): FuenteDatos {
  return hayApi ? fuenteApi() : fuenteDemo();
}

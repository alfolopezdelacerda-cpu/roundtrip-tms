"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  alPerderSesion,
  cerrarSesion as cerrarSesionApi,
  hayApi,
  iniciarSesion as iniciarSesionApi,
  leerSesion,
  type Sesion,
} from "./api";
import {
  crearFuente,
  type Datos,
  type DatosAsignacion,
  type DatosMonitoreoManual,
  type FuenteDatos,
  type Modo,
  type ResultadoBorrado,
} from "./datos";
import type { ClaveCatalogo, Cliente, ItemCatalogo, TipoUnidad } from "./catalogos";
import type {
  EstadoViaje,
  Operador,
  Proveedor,
  Ruta,
  Unidad,
  Viaje,
} from "./types";

type Store = {
  modo: Modo;
  cargando: boolean;
  error: string | null;
  /** Con API configurada y sin sesión válida, la aplicación pide entrar. */
  necesitaLogin: boolean;
  usuario: Sesion["usuario"] | null;

  viajes: Viaje[];
  clientes: Cliente[];
  proveedores: Proveedor[];
  unidades: Unidad[];
  operadores: Operador[];
  puertos: ItemCatalogo[];
  tiposNegocio: ItemCatalogo[];
  tiposUnidad: TipoUnidad[];
  tiposMercancia: ItemCatalogo[];
  rutas: Ruta[];

  entrar: (email: string, password: string, mfaCode?: string) => Promise<void>;
  salir: () => Promise<void>;
  recargar: () => Promise<void>;

  agregarViaje: (v: Omit<Viaje, "id" | "folio" | "cartaPorte">) => Promise<Viaje>;
  asignar: (id: string, datos: DatosAsignacion) => Promise<void>;
  actualizarMonitoreo: (id: string, datos: DatosMonitoreoManual) => Promise<void>;
  cambiarEstado: (id: string, estado: EstadoViaje) => Promise<void>;
  facturar: (id: string, factura: string, fechaFactura: string) => Promise<void>;
  marcarCobrado: (id: string) => Promise<void>;
  autorizarPago: (id: string) => Promise<void>;
  marcarPagado: (id: string, referencia: string) => Promise<void>;
  liquidar: (id: string) => Promise<void>;

  agregarCatalogo: (clave: ClaveCatalogo, item: Record<string, unknown>) => Promise<void>;
  actualizarCatalogo: (
    clave: ClaveCatalogo,
    id: string,
    cambios: Record<string, unknown>,
  ) => Promise<void>;
  eliminarCatalogo: (clave: ClaveCatalogo, id: string) => Promise<ResultadoBorrado>;
  usosDeCatalogo: (clave: ClaveCatalogo, id: string) => number;

  unidad: (id: string) => Unidad | undefined;
  operador: (id: string) => Operador | undefined;
  proveedor: (id: string) => Proveedor | undefined;
  ruta: (id: string) => Ruta | undefined;
  nombreDe: (clave: ClaveCatalogo, id: string) => string;
  ejecutor: (v: Viaje) => string;
  esFull: (tipoUnidadId: string) => boolean;
};

const VACIO: Datos = {
  viajes: [],
  clientes: [],
  proveedores: [],
  unidades: [],
  operadores: [],
  puertos: [],
  tiposNegocio: [],
  tiposUnidad: [],
  tiposMercancia: [],
  rutas: [],
};

/** Campo del viaje que apunta a cada catálogo, para contar usos. */
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
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const fuente = useRef<FuenteDatos>(undefined as unknown as FuenteDatos);
  if (!fuente.current) fuente.current = crearFuente();

  const [datos, setDatos] = useState<Datos>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Sesion["usuario"] | null>(null);
  // Solo el modo API exige sesión; en demostración se entra directo.
  const [necesitaLogin, setNecesitaLogin] = useState(hayApi);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await fuente.current.cargar());
    } catch (e) {
      setDatos(VACIO);
      setError(e instanceof Error ? e.message : "No se pudieron cargar los datos");
    } finally {
      setCargando(false);
    }
  }, []);

  // Arranque: en modo API se espera a tener sesión antes de pedir nada.
  useEffect(() => {
    if (!hayApi) {
      setNecesitaLogin(false);
      void cargar();
      return;
    }

    const sesion = leerSesion();
    if (sesion?.accessToken) {
      setUsuario(sesion.usuario ?? null);
      setNecesitaLogin(false);
      void cargar();
    } else {
      setCargando(false);
    }
  }, [cargar]);

  // El cliente HTTP avisa cuando el refresh token ya no sirve.
  useEffect(
    () =>
      alPerderSesion(() => {
        setUsuario(null);
        setNecesitaLogin(true);
        setDatos(VACIO);
      }),
    [],
  );

  const entrar = useCallback(
    async (email: string, password: string, mfaCode?: string) => {
      const perfil = await iniciarSesionApi(email, password, mfaCode);
      setUsuario(perfil ?? null);
      setNecesitaLogin(false);
      await cargar();
    },
    [cargar],
  );

  const salir = useCallback(async () => {
    await cerrarSesionApi();
    setUsuario(null);
    setNecesitaLogin(true);
    setDatos(VACIO);
  }, []);

  /** Reemplaza en la lista el viaje que la acción devolvió actualizado. */
  const reemplazar = useCallback((v: Viaje) => {
    setDatos((prev) => ({
      ...prev,
      viajes: prev.viajes.map((x) => (x.id === v.id ? v : x)),
    }));
  }, []);

  /**
   * Envuelve una acción sobre un servicio: si el backend la rechaza, el
   * mensaje se muestra en pantalla en vez de perderse en la consola.
   */
  const accion = useCallback(
    async (ejecutar: () => Promise<Viaje>) => {
      try {
        setError(null);
        reemplazar(await ejecutar());
      } catch (e) {
        setError(e instanceof Error ? e.message : "La operación falló");
      }
    },
    [reemplazar],
  );

  const value = useMemo<Store>(() => {
    const f = fuente.current;

    const unidad = (id: string) => datos.unidades.find((u) => u.id === id) as Unidad | undefined;
    const operador = (id: string) =>
      datos.operadores.find((o) => o.id === id) as Operador | undefined;
    const proveedor = (id: string) =>
      datos.proveedores.find((p) => p.id === id) as Proveedor | undefined;
    const ruta = (id: string) => datos.rutas.find((r) => r.id === id) as Ruta | undefined;

    const nombreDe = (clave: ClaveCatalogo, id: string) => {
      const item = datos[clave].find((i) => i.id === id) as
        | Record<string, unknown>
        | undefined;
      if (!item) return "—";
      if (clave === "unidades") return String(item.economico ?? "—");
      if (clave === "rutas") return String(item.codigo ?? "—");
      return String(item.nombre ?? "—");
    };

    return {
      modo: f.modo,
      cargando,
      error,
      necesitaLogin,
      usuario,

      viajes: datos.viajes,
      clientes: datos.clientes as unknown as Cliente[],
      proveedores: datos.proveedores as unknown as Proveedor[],
      unidades: datos.unidades as unknown as Unidad[],
      operadores: datos.operadores as unknown as Operador[],
      puertos: datos.puertos as unknown as ItemCatalogo[],
      tiposNegocio: datos.tiposNegocio as unknown as ItemCatalogo[],
      tiposUnidad: datos.tiposUnidad as unknown as TipoUnidad[],
      tiposMercancia: datos.tiposMercancia as unknown as ItemCatalogo[],
      rutas: datos.rutas as unknown as Ruta[],

      entrar,
      salir,
      recargar: cargar,

      agregarViaje: async (v) => {
        const creado = await f.crearViaje(v);
        setDatos((prev) => ({ ...prev, viajes: [creado, ...prev.viajes] }));
        return creado;
      },

      asignar: (id, datosAsignacion) => accion(() => f.asignar(id, datosAsignacion)),
      actualizarMonitoreo: (id, datosMonitoreo) =>
        accion(() => f.actualizarMonitoreo(id, datosMonitoreo)),
      cambiarEstado: (id, estado) => accion(() => f.cambiarEstado(id, estado)),
      facturar: (id, factura, fecha) => accion(() => f.facturar(id, factura, fecha)),
      marcarCobrado: (id) => accion(() => f.marcarCobrado(id)),
      autorizarPago: (id) => accion(() => f.autorizarPago(id)),
      marcarPagado: (id, referencia) => accion(() => f.marcarPagado(id, referencia)),
      liquidar: (id) => accion(() => f.liquidar(id)),

      agregarCatalogo: async (clave, item) => {
        try {
          setError(null);
          setDatos(await f.crearCatalogo(clave, item));
        } catch (e) {
          setError(e instanceof Error ? e.message : "No se pudo crear el registro");
        }
      },

      actualizarCatalogo: async (clave, id, cambios) => {
        try {
          setError(null);
          setDatos(await f.actualizarCatalogo(clave, id, cambios));
        } catch (e) {
          setError(e instanceof Error ? e.message : "No se pudo actualizar");
        }
      },

      eliminarCatalogo: async (clave, id) => {
        const resultado = await f.eliminarCatalogo(clave, id);
        await cargar();
        return resultado;
      },

      usosDeCatalogo: (clave, id) =>
        datos.viajes.filter((v) => v[CAMPO_EN_VIAJE[clave]] === id).length,

      unidad,
      operador,
      proveedor,
      ruta,
      nombreDe,
      ejecutor: (v: Viaje) =>
        v.asignacion === "TDC"
          ? (operador(v.operadorId)?.nombre ?? "Sin asignar")
          : (proveedor(v.proveedorId)?.nombre ?? "Sin proveedor"),
      esFull: (tipoUnidadId: string) =>
        Boolean(
          (datos.tiposUnidad.find((t) => t.id === tipoUnidadId) as TipoUnidad | undefined)
            ?.full,
        ),
    };
  }, [datos, cargando, error, necesitaLogin, usuario, entrar, salir, cargar, accion]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de <StoreProvider>");
  return ctx;
}

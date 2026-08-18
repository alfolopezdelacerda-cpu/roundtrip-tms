"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { operadoresSeed, proveedoresSeed, unidadesSeed, viajesSeed } from "./seed";
import {
  clientesSeed,
  puertosSeed,
  tiposMercanciaSeed,
  tiposNegocioSeed,
  tiposUnidadSeed,
  type ClaveCatalogo,
  type Cliente,
  type ItemCatalogo,
  type TipoUnidad,
} from "./catalogos";
import type {
  EstadoViaje,
  Operador,
  Proveedor,
  Unidad,
  Viaje,
} from "./types";

// Se versiona la clave en cada cambio de esquema: los datos guardados con el
// modelo anterior ya no encajan y es preferible partir del seed nuevo.
const STORAGE_KEY = "roundtrip-tms:v3";

type Data = {
  viajes: Viaje[];
  clientes: Cliente[];
  proveedores: Proveedor[];
  unidades: Unidad[];
  operadores: Operador[];
  puertos: ItemCatalogo[];
  tiposNegocio: ItemCatalogo[];
  tiposUnidad: TipoUnidad[];
  tiposMercancia: ItemCatalogo[];
};

/** Cualquier registro de catálogo: todos comparten id y nombre. */
type RegistroCatalogo = { id: string; nombre?: string; activo: boolean } & Record<
  string,
  unknown
>;

type Store = Data & {
  hidratado: boolean;

  agregarViaje: (v: Omit<Viaje, "id" | "folio" | "cartaPorte">) => Viaje;
  cambiarEstado: (id: string, estado: EstadoViaje) => void;
  facturar: (id: string, factura: string, fechaFactura: string) => void;
  marcarCobrado: (id: string) => void;
  autorizarPago: (id: string) => void;
  marcarPagado: (id: string, referencia: string) => void;
  liquidar: (id: string) => void;

  agregarCatalogo: (clave: ClaveCatalogo, item: Record<string, unknown>) => void;
  actualizarCatalogo: (
    clave: ClaveCatalogo,
    id: string,
    cambios: Record<string, unknown>,
  ) => void;
  eliminarCatalogo: (clave: ClaveCatalogo, id: string) => void;
  /** Cuántos servicios usan un registro de catálogo (para no borrar a ciegas). */
  usosDeCatalogo: (clave: ClaveCatalogo, id: string) => number;

  unidad: (id: string) => Unidad | undefined;
  operador: (id: string) => Operador | undefined;
  proveedor: (id: string) => Proveedor | undefined;
  /** Nombre de un registro de catálogo, o "—" si ya no existe. */
  nombreDe: (clave: ClaveCatalogo, id: string) => string;
  /** Nombre de quien ejecuta el servicio: operador propio o proveedor. */
  ejecutor: (v: Viaje) => string;
  /** Si el tipo de unidad del servicio admite un segundo contenedor. */
  esFull: (tipoUnidadId: string) => boolean;

  reiniciar: () => void;
};

const seed: Data = {
  viajes: viajesSeed,
  clientes: clientesSeed,
  proveedores: proveedoresSeed,
  unidades: unidadesSeed,
  operadores: operadoresSeed,
  puertos: puertosSeed,
  tiposNegocio: tiposNegocioSeed,
  tiposUnidad: tiposUnidadSeed,
  tiposMercancia: tiposMercanciaSeed,
};

/** Campo de cada servicio que apunta a un catálogo, para contar usos. */
const CAMPO_DE_CATALOGO: Record<ClaveCatalogo, keyof Viaje> = {
  clientes: "clienteId",
  proveedores: "proveedorId",
  unidades: "unidadId",
  operadores: "operadorId",
  puertos: "puertoId",
  tiposNegocio: "tipoNegocioId",
  tiposUnidad: "tipoUnidadId",
  tiposMercancia: "tipoMercanciaId",
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(seed);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // Se fusiona con el seed para que una versión guardada sin algún
        // catálogo nuevo no deje la pantalla en blanco.
        setData({ ...seed, ...(JSON.parse(raw) as Partial<Data>) });
      }
    } catch {
      // almacenamiento no disponible: se sigue con los datos demo
    }
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignorar cuota / modo privado
    }
  }, [data, hidratado]);

  const actualizar = useCallback((id: string, cambio: (v: Viaje) => Viaje) => {
    setData((prev) => ({
      ...prev,
      viajes: prev.viajes.map((v) => (v.id === id ? cambio(v) : v)),
    }));
  }, []);

  const agregarViaje = useCallback((v: Omit<Viaje, "id" | "folio" | "cartaPorte">) => {
    const creado = { ...v, id: `v${Date.now()}`, folio: "", cartaPorte: "" } as Viaje;
    setData((prev) => {
      // Folio y carta porte se derivan del consecutivo más alto ya existente.
      const consecutivo =
        prev.viajes.reduce((m, x) => {
          const n = Number(x.folio.replace(/\D/g, ""));
          return Number.isFinite(n) && n > m ? n : m;
        }, 2600) + 1;

      creado.folio = `RT-${consecutivo}`;
      creado.cartaPorte = `CP-${new Date().getFullYear()}-${consecutivo}`;
      return { ...prev, viajes: [creado, ...prev.viajes] };
    });
    return creado;
  }, []);

  const cambiarEstado = useCallback(
    (id: string, estado: EstadoViaje) =>
      actualizar(id, (v) => ({
        ...v,
        estado,
        monitoreo: {
          ...v.monitoreo,
          avance: estado === "completado" ? 100 : v.monitoreo.avance,
          actualizado: new Date().toISOString(),
        },
      })),
    [actualizar],
  );

  const facturar = useCallback(
    (id: string, factura: string, fechaFactura: string) =>
      actualizar(id, (v) => ({
        ...v,
        cobro: { ...v.cobro, estado: "facturado", factura, fechaFactura },
      })),
    [actualizar],
  );

  const marcarCobrado = useCallback(
    (id: string) =>
      actualizar(id, (v) => ({ ...v, cobro: { ...v.cobro, estado: "cobrado" } })),
    [actualizar],
  );

  const autorizarPago = useCallback(
    (id: string) =>
      actualizar(id, (v) => ({ ...v, pago: { ...v.pago, estado: "autorizado" } })),
    [actualizar],
  );

  const marcarPagado = useCallback(
    (id: string, referencia: string) =>
      actualizar(id, (v) => ({
        ...v,
        pago: {
          estado: "pagado",
          referencia,
          fechaPago: new Date().toISOString().slice(0, 10),
        },
      })),
    [actualizar],
  );

  const liquidar = useCallback(
    (id: string) =>
      actualizar(id, (v) => ({
        ...v,
        liquidacion: {
          estado: "liquidado",
          fecha: new Date().toISOString().slice(0, 10),
        },
      })),
    [actualizar],
  );

  // ---- Catálogos ----

  const agregarCatalogo = useCallback(
    (clave: ClaveCatalogo, item: Record<string, unknown>) =>
      setData((prev) => {
        const lista = prev[clave] as RegistroCatalogo[];
        const nuevo = {
          ...item,
          id: `${clave.slice(0, 2)}${Date.now()}`,
          activo: true,
        } as RegistroCatalogo;
        return { ...prev, [clave]: [...lista, nuevo] };
      }),
    [],
  );

  const actualizarCatalogo = useCallback(
    (clave: ClaveCatalogo, id: string, cambios: Record<string, unknown>) =>
      setData((prev) => {
        const lista = prev[clave] as RegistroCatalogo[];
        return {
          ...prev,
          [clave]: lista.map((i) => (i.id === id ? { ...i, ...cambios } : i)),
        };
      }),
    [],
  );

  const eliminarCatalogo = useCallback(
    (clave: ClaveCatalogo, id: string) =>
      setData((prev) => {
        const lista = prev[clave] as RegistroCatalogo[];
        return { ...prev, [clave]: lista.filter((i) => i.id !== id) };
      }),
    [],
  );

  const reiniciar = useCallback(() => setData(seed), []);

  const value = useMemo<Store>(() => {
    const unidad = (id: string) => data.unidades.find((u) => u.id === id);
    const operador = (id: string) => data.operadores.find((o) => o.id === id);
    const proveedor = (id: string) => data.proveedores.find((p) => p.id === id);

    const nombreDe = (clave: ClaveCatalogo, id: string) => {
      const lista = data[clave] as RegistroCatalogo[];
      const item = lista.find((i) => i.id === id);
      if (!item) return "—";
      // Unidades y operadores no tienen `nombre`: se identifican distinto.
      if (clave === "unidades") return (item as unknown as Unidad).economico;
      return (item.nombre as string) ?? "—";
    };

    return {
      ...data,
      hidratado,
      agregarViaje,
      cambiarEstado,
      facturar,
      marcarCobrado,
      autorizarPago,
      marcarPagado,
      liquidar,
      agregarCatalogo,
      actualizarCatalogo,
      eliminarCatalogo,
      usosDeCatalogo: (clave, id) => {
        const campo = CAMPO_DE_CATALOGO[clave];
        return data.viajes.filter((v) => v[campo] === id).length;
      },
      unidad,
      operador,
      proveedor,
      nombreDe,
      ejecutor: (v: Viaje) =>
        v.asignacion === "TDC"
          ? (operador(v.operadorId)?.nombre ?? "Sin asignar")
          : (proveedor(v.proveedorId)?.nombre ?? "Sin proveedor"),
      esFull: (tipoUnidadId: string) =>
        data.tiposUnidad.find((t) => t.id === tipoUnidadId)?.full ?? false,
      reiniciar,
    };
  }, [
    data,
    hidratado,
    agregarViaje,
    cambiarEstado,
    facturar,
    marcarCobrado,
    autorizarPago,
    marcarPagado,
    liquidar,
    agregarCatalogo,
    actualizarCatalogo,
    eliminarCatalogo,
    reiniciar,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de <StoreProvider>");
  return ctx;
}

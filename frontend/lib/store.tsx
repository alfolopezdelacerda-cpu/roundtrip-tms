"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  operadoresSeed,
  proveedoresSeed,
  unidadesSeed,
  viajesSeed,
} from "./seed";
import type {
  EstadoViaje,
  Operador,
  Proveedor,
  Unidad,
  Viaje,
} from "./types";

// Se versiona la clave: el modelo cambió (asignación, cobro, pago,
// liquidación) y los datos guardados con el esquema viejo ya no encajan.
const STORAGE_KEY = "roundtrip-tms:v2";

type Data = {
  viajes: Viaje[];
  unidades: Unidad[];
  operadores: Operador[];
  proveedores: Proveedor[];
};

type Store = Data & {
  hidratado: boolean;
  agregarViaje: (v: Omit<Viaje, "id" | "folio">) => Viaje;
  cambiarEstado: (id: string, estado: EstadoViaje) => void;
  facturar: (id: string, factura: string, fechaFactura: string) => void;
  marcarCobrado: (id: string) => void;
  autorizarPago: (id: string) => void;
  marcarPagado: (id: string, referencia: string) => void;
  liquidar: (id: string) => void;
  unidad: (id: string) => Unidad | undefined;
  operador: (id: string) => Operador | undefined;
  proveedor: (id: string) => Proveedor | undefined;
  /** Nombre de quien ejecuta el servicio: operador propio o proveedor. */
  ejecutor: (v: Viaje) => string;
  reiniciar: () => void;
};

const seed: Data = {
  viajes: viajesSeed,
  unidades: unidadesSeed,
  operadores: operadoresSeed,
  proveedores: proveedoresSeed,
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(seed);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setData(JSON.parse(raw) as Data);
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

  /** Aplica un cambio a un solo viaje sin tocar el resto del estado. */
  const actualizar = useCallback((id: string, cambio: (v: Viaje) => Viaje) => {
    setData((prev) => ({
      ...prev,
      viajes: prev.viajes.map((v) => (v.id === id ? cambio(v) : v)),
    }));
  }, []);

  const agregarViaje = useCallback((v: Omit<Viaje, "id" | "folio">) => {
    const creado: Viaje = { ...v, id: `v${Date.now()}`, folio: "" };
    setData((prev) => {
      const max = prev.viajes.reduce((m, x) => {
        const n = Number(x.folio.replace(/\D/g, ""));
        return Number.isFinite(n) && n > m ? n : m;
      }, 2600);
      creado.folio = `RT-${max + 1}`;
      return { ...prev, viajes: [creado, ...prev.viajes] };
    });
    return creado;
  }, []);

  const cambiarEstado = useCallback(
    (id: string, estado: EstadoViaje) =>
      actualizar(id, (v) => ({
        ...v,
        estado,
        // Cerrar el servicio implica avance completo; cancelarlo lo congela.
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

  const reiniciar = useCallback(() => setData(seed), []);

  const value = useMemo<Store>(() => {
    const unidad = (id: string) => data.unidades.find((u) => u.id === id);
    const operador = (id: string) => data.operadores.find((o) => o.id === id);
    const proveedor = (id: string) => data.proveedores.find((p) => p.id === id);

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
      reiniciar,
      unidad,
      operador,
      proveedor,
      ejecutor: (v: Viaje) =>
        v.asignacion === "TDC"
          ? (operador(v.operadorId)?.nombre ?? "Sin asignar")
          : (proveedor(v.proveedorId)?.nombre ?? "Sin proveedor"),
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
    reiniciar,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de <StoreProvider>");
  return ctx;
}

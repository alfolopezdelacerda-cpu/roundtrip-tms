"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Kpi, PageTitle } from "@/components/ui";
import {
  AsignacionBadge,
  PagoBadge,
  TablaServicios,
  Totales,
  columnaFolio,
  columnaRuta,
  type Columna,
} from "@/components/servicios";
import { mxn } from "@/lib/format";
import type { Asignacion } from "@/lib/types";

/**
 * Cuentas por pagar: lo que ADL debe por la ejecución de los servicios.
 *
 * En FWD el acreedor es el proveedor externo; en TDC es el costo operativo
 * propio (diésel, casetas, liquidación del operador). Se listan juntos
 * porque tesorería paga de la misma bolsa.
 *
 * Muestra todos los servicios vivos, incluidos los que aún no tienen costo
 * capturado: verlos en cero es justamente lo que recuerda que falta
 * capturarlos en Finanzas › Rentabilidad por viaje.
 */
export default function CXP() {
  const { viajes, proveedor, autorizarPago, marcarPagado } = useStore();
  const [filtro, setFiltro] = useState<Asignacion | "todos">("todos");

  const porPagar = viajes
    .filter((v) => v.estado !== "cancelado" && v.pago.estado !== "pagado")
    .filter((v) => (filtro === "todos" ? true : v.asignacion === filtro))
    .sort((a, b) => b.costo - a.costo);

  const sinCosto = porPagar.filter((v) => v.costo === 0).length;

  const porAutorizar = porPagar.filter((v) => v.pago.estado === "pendiente");
  const autorizados = porPagar.filter((v) => v.pago.estado === "autorizado");
  const total = porPagar.reduce((s, v) => s + v.costo, 0);

  const columnaAcreedor: Columna = {
    clave: "acreedor",
    titulo: "Acreedor",
    celda: (v) => {
      if (v.asignacion === "FWD") {
        const p = proveedor(v.proveedorId);
        return p ? (
          <span>
            {p.nombre} <span className="text-muted">· {p.diasPago} días</span>
          </span>
        ) : (
          <span className="text-rose-700">Sin proveedor</span>
        );
      }
      return <span className="text-muted">Costo operativo propio</span>;
    },
  };

  const columnaOrigen: Columna = {
    clave: "origen",
    titulo: "Origen",
    celda: (v) => <AsignacionBadge asignacion={v.asignacion} />,
  };

  const columnaCosto: Columna = {
    clave: "costo",
    titulo: "Importe",
    alineacion: "der",
    celda: (v) => mxn(v.costo),
  };

  const columnaEstadoPago: Columna = {
    clave: "estadoPago",
    titulo: "Estado",
    celda: (v) => <PagoBadge estado={v.pago.estado} />,
  };

  const columnaAccion: Columna = {
    clave: "accion",
    titulo: "",
    alineacion: "der",
    celda: (v) =>
      v.pago.estado === "pendiente" ? (
        // Autorizar un pago de cero no significa nada: primero hay que
        // capturar el costo operativo.
        v.costo === 0 ? (
          <span className="text-xs text-muted">Sin costo</span>
        ) : (
          <button
            onClick={() => autorizarPago(v.id)}
            className="rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
          >
            Autorizar
          </button>
        )
      ) : (
        <button
          onClick={() => marcarPagado(v.id, `SPEI-${88000 + Math.floor(Math.random() * 900)}`)}
          className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-black/[0.03]"
        >
          Marcar pagado
        </button>
      ),
  };

  return (
    <>
      <PageTitle
        title="CXP"
        subtitle="Cuentas por pagar de todos los servicios: proveedores externos (FWD) y costo operativo propio (TDC)."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total por pagar" value={mxn(total)} hint={`${porPagar.length} servicios`} />
        <Kpi
          label="Por autorizar"
          value={mxn(porAutorizar.reduce((s, v) => s + v.costo, 0))}
          hint={`${porAutorizar.length} servicios`}
        />
        <Kpi
          label="Autorizado"
          value={mxn(autorizados.reduce((s, v) => s + v.costo, 0))}
          hint="Listo para pago"
        />
        <Kpi
          label="Sin costo capturado"
          value={String(sinCosto)}
          hint={sinCosto ? "captúralo en Rentabilidad" : "todos capturados"}
        />
      </div>

      <div className="mt-6 mb-4 flex flex-wrap gap-2">
        {(["todos", "TDC", "FWD"] as const).map((op) => (
          <button
            key={op}
            onClick={() => setFiltro(op)}
            className={`rounded-md px-3 py-1.5 text-sm ring-1 ring-inset transition-colors ${
              filtro === op
                ? "bg-ink text-white ring-transparent"
                : "bg-white ring-[#DEE3DD] hover:bg-black/[0.03]"
            }`}
          >
            {op === "todos" ? "Todos" : op}
          </button>
        ))}
      </div>

      <div>
        <TablaServicios
          viajes={porPagar}
          vacio="No hay cuentas por pagar."
          totales={<Totales items={[{ label: "Suma en pantalla", valor: mxn(total) }]} />}
          columnas={[
            columnaFolio,
            columnaRuta,
            columnaAcreedor,
            columnaOrigen,
            columnaCosto,
            columnaEstadoPago,
            columnaAccion,
          ]}
        />
      </div>
    </>
  );
}

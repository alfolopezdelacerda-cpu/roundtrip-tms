"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Kpi, PageTitle } from "@/components/ui";
import {
  AsignacionBadge,
  CobroBadge,
  TablaServicios,
  Totales,
  columnaCliente,
  columnaFolio,
  columnaRuta,
  columnaTarifa,
  type Columna,
} from "@/components/servicios";
import { fecha, mxn } from "@/lib/format";
import { vencimientoCobro, type Asignacion } from "@/lib/types";

/**
 * Cuentas por cobrar: lo que los clientes deben, propio (TDC) y de proveedor
 * (FWD) por igual.
 *
 * Muestra todos los servicios vivos, no solo los ya terminados: contabilidad
 * necesita ver la cartera que viene, no solo la que ya se puede facturar.
 * Facturar sigue exigiendo que el servicio esté completado —lo valida el
 * backend—, así que el botón solo aparece cuando toca.
 */
export default function CXC() {
  const { viajes, facturar, marcarCobrado } = useStore();
  const [filtro, setFiltro] = useState<Asignacion | "todos">("todos");

  const cartera = viajes
    .filter((v) => v.estado !== "cancelado" && v.cobro.estado !== "cobrado")
    .filter((v) => (filtro === "todos" ? true : v.asignacion === filtro))
    .sort((a, b) => (b.cobro.fechaFactura ?? "").localeCompare(a.cobro.fechaFactura ?? ""));

  const porFacturar = cartera.filter((v) => v.cobro.estado === "pendiente");
  const vencidos = cartera.filter((v) => v.cobro.estado === "vencido");
  const total = cartera.reduce((s, v) => s + v.tarifa, 0);

  const columnaAsignacion: Columna = {
    clave: "asignacion",
    titulo: "Origen",
    celda: (v) => <AsignacionBadge asignacion={v.asignacion} />,
  };

  const columnaFactura: Columna = {
    clave: "factura",
    titulo: "Factura",
    celda: (v) =>
      v.cobro.factura ? (
        <span className="font-mono text-xs">{v.cobro.factura}</span>
      ) : (
        <span className="text-muted">—</span>
      ),
  };

  const columnaVencimiento: Columna = {
    clave: "vencimiento",
    titulo: "Vence",
    celda: (v) => {
      const venc = vencimientoCobro(v);
      if (!venc) return <span className="text-muted">—</span>;
      const vencido = v.cobro.estado === "vencido";
      return (
        <span className={vencido ? "font-medium text-rose-700" : "text-muted"}>
          {fecha(venc)}
        </span>
      );
    },
  };

  const columnaCredito: Columna = {
    clave: "credito",
    titulo: "Crédito",
    alineacion: "der",
    celda: (v) => <span className="text-muted">{v.cobro.diasCredito} días</span>,
  };

  const columnaEstadoCobro: Columna = {
    clave: "estadoCobro",
    titulo: "Estado",
    celda: (v) => <CobroBadge estado={v.cobro.estado} />,
  };

  const columnaAccion: Columna = {
    clave: "accion",
    titulo: "",
    alineacion: "der",
    celda: (v) =>
      v.cobro.estado === "pendiente" ? (
        // No se factura un servicio que aún no termina: el backend lo rechaza,
        // así que aquí ni se ofrece.
        v.estado !== "completado" ? (
          <span className="text-xs text-muted">Al completar</span>
        ) : (
          <button
            onClick={() =>
              facturar(
                v.id,
                `A-${10500 + Math.floor(Math.random() * 400)}`,
                new Date().toISOString().slice(0, 10),
              )
            }
            className="rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
          >
            Facturar
          </button>
        )
      ) : (
        <button
          onClick={() => marcarCobrado(v.id)}
          className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-black/[0.03]"
        >
          Marcar cobrado
        </button>
      ),
  };

  return (
    <>
      <PageTitle
        title="CXC"
        subtitle="Cuentas por cobrar de todos los servicios, propios (TDC) y de proveedor (FWD)."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Cartera total" value={mxn(total)} hint={`${cartera.length} servicios`} />
        <Kpi
          label="Por facturar"
          value={mxn(porFacturar.reduce((s, v) => s + v.tarifa, 0))}
          hint={`${porFacturar.length} servicios`}
        />
        <Kpi
          label="Vencido"
          value={mxn(vencidos.reduce((s, v) => s + v.tarifa, 0))}
          hint={`${vencidos.length} facturas`}
        />
        <Kpi
          label="Cobrado"
          value={mxn(
            viajes
              .filter((v) => v.cobro.estado === "cobrado")
              .reduce((s, v) => s + v.tarifa, 0),
          )}
          hint="Histórico"
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
          viajes={cartera}
          vacio="No hay cuentas por cobrar."
          totales={<Totales items={[{ label: "Suma en pantalla", valor: mxn(total) }]} />}
          columnas={[
            columnaFolio,
            columnaCliente,
            columnaRuta,
            columnaAsignacion,
            columnaFactura,
            columnaCredito,
            columnaVencimiento,
            columnaTarifa,
            columnaEstadoCobro,
            columnaAccion,
          ]}
        />
      </div>
    </>
  );
}

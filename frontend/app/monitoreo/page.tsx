"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, Empty, Kpi, PageTitle } from "@/components/ui";
import {
  AsignacionBadge,
  Barra,
  EstadoBadge,
  FolioLink,
  Ruta,
} from "@/components/servicios";
import { fecha } from "@/lib/format";
import { VIAJE_ACTIVO, type Asignacion } from "@/lib/types";

/**
 * Seguimiento de viaje de ambos orígenes: los propios (TDC) y los de
 * proveedor (FWD). Es la única vista que mezcla las dos asignaciones, porque
 * la operación necesita ver todo lo que está en la calle en un solo lugar.
 */
export default function Monitoreo() {
  const { viajes, ejecutor } = useStore();
  const [filtro, setFiltro] = useState<Asignacion | "todos">("todos");

  const enRuta = viajes
    .filter((v) => VIAJE_ACTIVO.includes(v.estado))
    .filter((v) => (filtro === "todos" ? true : v.asignacion === filtro))
    .sort((a, b) => b.monitoreo.avance - a.monitoreo.avance);

  const activos = viajes.filter((v) => VIAJE_ACTIVO.includes(v.estado));
  const tdc = activos.filter((v) => v.asignacion === "TDC").length;
  const fwd = activos.filter((v) => v.asignacion === "FWD").length;
  const enCamino = activos.filter((v) => v.estado !== "programado").length;

  return (
    <>
      <PageTitle
        title="Monitoreo"
        subtitle="Seguimiento de servicios en curso, propios y de proveedor."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Servicios activos" value={String(activos.length)} />
        <Kpi label="En camino" value={String(enCamino)} hint="Excluye programados" />
        <Kpi label="Transportadora" value={String(tdc)} hint="TDC" />
        <Kpi label="Proveedor externo" value={String(fwd)} hint="FWD" />
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

      {enRuta.length === 0 ? (
        <Card>
          <Empty>No hay servicios activos con este filtro.</Empty>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {enRuta.map((v) => (
            <Card key={v.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <FolioLink viaje={v} />
                  <p className="mt-1">
                    <Ruta viaje={v} />
                  </p>
                  <p className="text-sm text-muted">{v.cliente}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <EstadoBadge estado={v.estado} />
                  <AsignacionBadge asignacion={v.asignacion} />
                </div>
              </div>

              <div className="mt-4">
                <Barra valor={v.monitoreo.avance} />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Dato k="Ubicación" v={v.monitoreo.ubicacion} />
                <Dato k="Ejecuta" v={ejecutor(v)} />
                <Dato k="Retorno estimado" v={fecha(v.retornoEstimado)} />
                <Dato
                  k="Actualizado"
                  v={new Date(v.monitoreo.actualizado).toLocaleString("es-MX", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                />
              </dl>

              <p className="mt-3 rounded-md bg-black/[0.03] px-3 py-2 text-sm text-muted">
                {v.monitoreo.ultimoEvento}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
      <dd className="mt-0.5 font-medium">{v}</dd>
    </div>
  );
}

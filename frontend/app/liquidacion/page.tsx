"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Kpi, PageTitle } from "@/components/ui";
import {
  AsignacionBadge,
  CobroBadge,
  PagoBadge,
  TablaServicios,
  Totales,
  columnaCliente,
  columnaFolio,
  columnaRuta,
  columnaTarifa,
  type Columna,
} from "@/components/servicios";
import { fecha, fechaHora, mxn } from "@/lib/format";
import { esLiquidable, margen } from "@/lib/types";

/**
 * Servicios finalizados listos para liquidar.
 *
 * Se liquida contra el cierre económico del servicio: por eso la tabla
 * muestra cobro y pago juntos. Liquidar un servicio cuyo cliente no ha
 * pagado o cuyo proveedor sigue sin cobrar es una decisión del área, no un
 * bloqueo del sistema, así que se avisa pero no se impide.
 */
export default function Liquidacion() {
  const { viajes, ejecutor, liquidar } = useStore();
  const [verLiquidados, setVerLiquidados] = useState(false);

  const finalizados = viajes
    .filter((v) => v.estado === "completado")
    .filter((v) => (verLiquidados ? true : esLiquidable(v)))
    .sort((a, b) => b.citaDescarga.localeCompare(a.citaDescarga));

  const pendientes = viajes.filter(esLiquidable);
  const importePendiente = pendientes.reduce((s, v) => s + v.costo, 0);
  const margenPendiente = pendientes.reduce((s, v) => s + margen(v), 0);
  const liquidados = viajes.filter(
    (v) => v.estado === "completado" && v.liquidacion.estado === "liquidado",
  );

  const columnaEjecutor: Columna = {
    clave: "ejecutor",
    titulo: "Ejecuta",
    celda: (v) => (
      <div className="flex flex-col gap-1">
        <span>{ejecutor(v)}</span>
        <AsignacionBadge asignacion={v.asignacion} />
      </div>
    ),
  };

  const columnaCierre: Columna = {
    clave: "cierre",
    titulo: "Cierre",
    celda: (v) => <span className="text-muted">{fechaHora(v.citaDescarga)}</span>,
  };

  const columnaCosto: Columna = {
    clave: "costo",
    titulo: "Costo",
    alineacion: "der",
    celda: (v) => <span className="text-muted">{mxn(v.costo)}</span>,
  };

  const columnaMargenLiq: Columna = {
    clave: "margen",
    titulo: "Margen",
    alineacion: "der",
    celda: (v) => {
      const m = margen(v);
      return <span className={m < 0 ? "text-rose-700" : undefined}>{mxn(m)}</span>;
    },
  };

  const columnaSituacion: Columna = {
    clave: "situacion",
    titulo: "Cobro / pago",
    celda: (v) => (
      <div className="flex flex-wrap gap-1">
        <CobroBadge estado={v.cobro.estado} />
        <PagoBadge estado={v.pago.estado} />
      </div>
    ),
  };

  const columnaAccion: Columna = {
    clave: "accion",
    titulo: "",
    alineacion: "der",
    celda: (v) =>
      v.liquidacion.estado === "liquidado" ? (
        <span className="whitespace-nowrap text-xs text-muted">
          Liquidado {v.liquidacion.fecha ? fecha(v.liquidacion.fecha) : ""}
        </span>
      ) : (
        <button
          onClick={() => liquidar(v.id)}
          className="rounded-md bg-amber px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
          title={
            v.cobro.estado !== "cobrado"
              ? "Ojo: el cliente aún no ha pagado este servicio"
              : undefined
          }
        >
          Liquidar
        </button>
      ),
  };

  return (
    <>
      <PageTitle
        title="Liquidación"
        subtitle="Servicios finalizados para su liquidación."
        action={
          <button
            onClick={() => setVerLiquidados((x) => !x)}
            className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-black/[0.03]"
          >
            {verLiquidados ? "Ver solo pendientes" : "Ver también liquidados"}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Por liquidar"
          value={String(pendientes.length)}
          hint={`${liquidados.length} ya liquidados`}
        />
        <Kpi label="Importe pendiente" value={mxn(importePendiente)} hint="Costo a liquidar" />
        <Kpi label="Margen pendiente" value={mxn(margenPendiente)} />
        <Kpi
          label="Sin cobrar al cliente"
          value={String(pendientes.filter((v) => v.cobro.estado !== "cobrado").length)}
          hint="Revisar antes de liquidar"
        />
      </div>

      <div className="mt-6">
        <TablaServicios
          viajes={finalizados}
          vacio="No hay servicios finalizados pendientes de liquidación."
          totales={
            <Totales
              items={[
                { label: "En pantalla", valor: String(finalizados.length) },
                { label: "Costo", valor: mxn(finalizados.reduce((s, v) => s + v.costo, 0)) },
              ]}
            />
          }
          columnas={[
            columnaFolio,
            columnaRuta,
            columnaCliente,
            columnaEjecutor,
            columnaCierre,
            columnaTarifa,
            columnaCosto,
            columnaMargenLiq,
            columnaSituacion,
            columnaAccion,
          ]}
        />
      </div>
    </>
  );
}

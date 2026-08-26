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
import { esLiquidable, margen, type Viaje } from "@/lib/types";

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
  const [modalViaje, setModalViaje] = useState<Viaje | null>(null);

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
          onClick={() => setModalViaje(v)}
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

      {modalViaje ? (
        <ModalLiquidar
          viaje={modalViaje}
          onCerrar={() => setModalViaje(null)}
          onGuardar={async (datos) => {
            await liquidar(modalViaje.id, datos);
            setModalViaje(null);
          }}
        />
      ) : null}
    </>
  );
}

function ModalLiquidar({
  viaje,
  onCerrar,
  onGuardar,
}: {
  viaje: Viaje;
  onCerrar: () => void;
  onGuardar: (datos: {
    combustible: number;
    casetas: number;
    gastosExtra: number;
    gastosExtraDetalle: string;
    evidencias: boolean;
  }) => Promise<void>;
}) {
  const [combustible, setCombustible] = useState("");
  const [casetas, setCasetas] = useState("");
  const [gastosExtra, setGastosExtra] = useState("");
  const [gastosExtraDetalle, setGastosExtraDetalle] = useState("");
  const [evidencias, setEvidencias] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const hayGastosExtra = Number(gastosExtra) > 0;

  async function guardar() {
    if (hayGastosExtra && !gastosExtraDetalle.trim()) {
      setError("Especifica de qué se tratan los gastos extra.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await onGuardar({
        combustible: Number(combustible) || 0,
        casetas: Number(casetas) || 0,
        gastosExtra: Number(gastosExtra) || 0,
        gastosExtraDetalle: gastosExtraDetalle.trim(),
        evidencias,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo liquidar el servicio");
    } finally {
      setGuardando(false);
    }
  }

  const campo =
    "w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber";
  const etiqueta = "mb-1 block text-xs font-medium uppercase tracking-wide text-muted";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
        <h2 className="text-sm font-semibold">Liquidar servicio {viaje.folio}</h2>
        <p className="mt-1 text-xs text-muted">{viaje.origen} → {viaje.destino}</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className={etiqueta}>Combustible que cargó la unidad (MXN)</label>
            <input
              type="number"
              min={0}
              className={campo}
              value={combustible}
              onChange={(e) => setCombustible(e.target.value)}
            />
          </div>

          <div>
            <label className={etiqueta}>Casetas que cruzó en el servicio (MXN)</label>
            <input
              type="number"
              min={0}
              className={campo}
              value={casetas}
              onChange={(e) => setCasetas(e.target.value)}
            />
          </div>

          <div>
            <label className={etiqueta}>Gastos extras (MXN)</label>
            <input
              type="number"
              min={0}
              className={campo}
              value={gastosExtra}
              onChange={(e) => setGastosExtra(e.target.value)}
            />
          </div>

          {hayGastosExtra ? (
            <div>
              <label className={etiqueta}>Especificar gastos extras *</label>
              <textarea
                rows={2}
                className={campo}
                value={gastosExtraDetalle}
                onChange={(e) => setGastosExtraDetalle(e.target.value)}
                placeholder="¿De qué se trataron los gastos extra?"
              />
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={evidencias}
              onChange={(e) => setEvidencias(e.target.checked)}
              className="h-4 w-4 accent-[#C97A0F]"
            />
            Entrega de evidencias físicas del servicio
          </label>
        </div>

        {error ? (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-black/[0.03]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="rounded-md bg-amber px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {guardando ? "Liquidando…" : "Liquidar"}
          </button>
        </div>
      </div>
    </div>
  );
}

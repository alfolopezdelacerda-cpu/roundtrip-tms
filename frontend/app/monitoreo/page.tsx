"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageTitle } from "@/components/ui";
import { fechaHora } from "@/lib/format";
import {
  ESTADO_LABEL,
  ESTADOS_VIAJE,
  VIAJE_ACTIVO,
  type Asignacion,
  type EstadoViaje,
  type Viaje,
} from "@/lib/types";

/**
 * Seguimiento de viaje de ambos orígenes (TDC y FWD) con estilo de tablero de
 * salidas de aeropuerto: una fila por servicio, alto contraste, tipografía
 * monoespaciada. Aquí es donde tráfico cambia el estatus y captura a mano
 * operador, medio de comunicación, unidad y placa reales — datos que en FWD
 * no existen en ningún catálogo porque son del proveedor.
 */
export default function Monitoreo() {
  const { viajes } = useStore();
  const [filtro, setFiltro] = useState<Asignacion | "todos">("todos");

  const activos = viajes.filter((v) => VIAJE_ACTIVO.includes(v.estado));
  const enRuta = activos
    .filter((v) => (filtro === "todos" ? true : v.asignacion === filtro))
    .sort((a, b) => a.citaDescarga.localeCompare(b.citaDescarga));

  const tdc = activos.filter((v) => v.asignacion === "TDC").length;
  const fwd = activos.filter((v) => v.asignacion === "FWD").length;
  const enCamino = activos.filter((v) => v.estado !== "programado").length;

  return (
    <>
      <PageTitle
        title="Monitoreo"
        subtitle="Seguimiento de servicios en curso, propios y de proveedor."
      />

      <div
        className="overflow-hidden rounded-xl border border-[#1c2b22] bg-[#0a120d] text-[#d7ffe0] shadow-[0_2px_20px_rgba(0,0,0,0.4)]"
        style={{ fontFamily: "'Courier New', ui-monospace, monospace" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2b22] px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs tracking-[0.2em] text-[#7fffa0]">
            <TableroKpi label="EN OPERACIÓN" value={activos.length} />
            <TableroKpi label="EN CAMINO" value={enCamino} />
            <TableroKpi label="TDC" value={tdc} />
            <TableroKpi label="FWD" value={fwd} />
          </div>
          <div className="flex gap-2">
            {(["todos", "TDC", "FWD"] as const).map((op) => (
              <button
                key={op}
                onClick={() => setFiltro(op)}
                className={`rounded px-3 py-1 text-xs tracking-widest transition-colors ${
                  filtro === op
                    ? "bg-[#7fffa0] text-[#0a120d]"
                    : "bg-transparent text-[#7fffa0] ring-1 ring-inset ring-[#2a3f30] hover:bg-[#132018]"
                }`}
              >
                {op === "todos" ? "TODOS" : op}
              </button>
            ))}
          </div>
        </div>

        {enRuta.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm tracking-widest text-[#4c6a56]">
            SIN SERVICIOS ACTIVOS CON ESTE FILTRO
          </div>
        ) : (
          <div className="divide-y divide-[#182821]">
            <div className="hidden grid-cols-[1fr_1.6fr_1.1fr_0.9fr_1.3fr_1.6fr_1.4fr] gap-3 px-5 py-2 text-[11px] tracking-[0.15em] text-[#4c6a56] lg:grid">
              <span>FOLIO / ASIG.</span>
              <span>RUTA</span>
              <span>CLIENTE</span>
              <span>ESTATUS</span>
              <span>OPERADOR / MEDIO</span>
              <span>UNIDAD / PLACA</span>
              <span>DESCARGA / EVENTO</span>
            </div>
            {enRuta.map((v) => (
              <FilaVuelo key={v.id} viaje={v} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function TableroKpi({ label, value }: { label: string; value: number }) {
  return (
    <span>
      {label} <span className="font-semibold text-[#d7ffe0]">{String(value).padStart(2, "0")}</span>
    </span>
  );
}

function FilaVuelo({ viaje: v }: { viaje: Viaje }) {
  const { ejecutor, cambiarEstado, actualizarMonitoreo } = useStore();

  const [operadorManual, setOperadorManual] = useState(v.monitoreo.operadorManual);
  const [medioComunicacion, setMedioComunicacion] = useState(v.monitoreo.medioComunicacion);
  const [unidadManual, setUnidadManual] = useState(v.monitoreo.unidadManual);
  const [placaManual, setPlacaManual] = useState(v.monitoreo.placaManual);

  const sucio =
    operadorManual !== v.monitoreo.operadorManual ||
    medioComunicacion !== v.monitoreo.medioComunicacion ||
    unidadManual !== v.monitoreo.unidadManual ||
    placaManual !== v.monitoreo.placaManual;

  async function guardarManual() {
    await actualizarMonitoreo(v.id, {
      operadorManual,
      medioComunicacion,
      unidadManual,
      placaManual,
    });
  }

  const inputCls =
    "w-full rounded bg-[#0e1a13] px-2 py-1 text-xs text-[#d7ffe0] outline-none ring-1 ring-inset ring-[#213326] placeholder:text-[#3a5545] focus:ring-[#7fffa0]";

  return (
    <div className="grid grid-cols-1 gap-3 px-5 py-3 lg:grid-cols-[1fr_1.6fr_1.1fr_0.9fr_1.3fr_1.6fr_1.4fr] lg:items-center">
      <div>
        <p className="text-lg font-bold tracking-widest">{v.folio}</p>
        <p className="text-[11px] tracking-[0.2em] text-[#4c6a56]">
          {v.asignacion === "TDC" ? "TRANSPORTADORA" : "PROVEEDOR"}
        </p>
      </div>

      <div>
        <p className="text-sm">
          {v.origen} <span className="text-[#4c6a56]">→</span> {v.destino}
        </p>
        <div className="mt-1 h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-[#182821]">
          <div
            className="h-full bg-[#7fffa0]"
            style={{ width: `${Math.max(0, Math.min(100, v.monitoreo.avance))}%` }}
          />
        </div>
      </div>

      <div className="truncate text-sm text-[#a9d9b8]">{v.cliente}</div>

      <div>
        <select
          value={v.estado}
          onChange={(e) => cambiarEstado(v.id, e.target.value as EstadoViaje)}
          className="w-full rounded bg-[#0e1a13] px-2 py-1 text-xs uppercase tracking-widest text-[#7fffa0] outline-none ring-1 ring-inset ring-[#2a3f30]"
        >
          {ESTADOS_VIAJE.filter((e) => e.value !== "por_asignar").map((e) => (
            <option key={e.value} value={e.value}>
              {ESTADO_LABEL[e.value].toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <input
          className={inputCls}
          value={operadorManual}
          onChange={(e) => setOperadorManual(e.target.value)}
          placeholder={`Operador (${ejecutor(v)})`}
        />
        <input
          className={inputCls}
          value={medioComunicacion}
          onChange={(e) => setMedioComunicacion(e.target.value)}
          placeholder="Medio de comunicación"
        />
      </div>

      <div className="space-y-1">
        <input
          className={inputCls}
          value={unidadManual}
          onChange={(e) => setUnidadManual(e.target.value)}
          placeholder="Unidad"
        />
        <div className="flex gap-1">
          <input
            className={inputCls}
            value={placaManual}
            onChange={(e) => setPlacaManual(e.target.value)}
            placeholder="Placa"
          />
          <button
            type="button"
            onClick={guardarManual}
            disabled={!sucio}
            className="shrink-0 rounded bg-[#7fffa0] px-2 py-1 text-[11px] font-semibold tracking-widest text-[#0a120d] disabled:opacity-30"
          >
            OK
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs text-[#4c6a56]">DESCARGA {fechaHora(v.citaDescarga)}</p>
        <p className="truncate text-xs text-[#a9d9b8]">{v.monitoreo.ultimoEvento}</p>
      </div>
    </div>
  );
}

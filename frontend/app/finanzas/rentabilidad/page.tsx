"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Card, Empty, Kpi, PageTitle } from "@/components/ui";
import { AsignacionBadge, EstadoBadge } from "@/components/servicios";
import { mxn } from "@/lib/format";
import { margen, rentabilidad, type Asignacion, type Viaje } from "@/lib/types";

const campo =
  "w-28 rounded-md border border-line bg-white px-2 py-1 text-right text-sm outline-none focus:border-amber";

/**
 * Rentabilidad por viaje: aquí se captura todo el costo operativo del
 * servicio y se ve, contra la tarifa de venta, cuánto deja realmente.
 *
 * El total nunca se escribe: es la suma del desglose, y es el mismo número
 * que CXP paga y que el margen usa en el resto del sistema.
 */
export default function Rentabilidad() {
  const { viajes } = useStore();
  const [filtro, setFiltro] = useState<Asignacion | "todos">("todos");

  // Los cancelados no se ejecutan, así que no tienen rentabilidad que medir.
  const vivos = viajes.filter((v) => v.estado !== "cancelado");
  const visibles = vivos
    .filter((v) => (filtro === "todos" ? true : v.asignacion === filtro))
    .sort((a, b) => b.citaCarga.localeCompare(a.citaCarga));

  const venta = visibles.reduce((s, v) => s + v.tarifa, 0);
  const costo = visibles.reduce((s, v) => s + v.costo, 0);
  const utilidad = venta - costo;
  const pct = venta ? Math.round((utilidad / venta) * 100) : 0;
  const enPerdida = visibles.filter((v) => v.tarifa > 0 && margen(v) < 0).length;

  return (
    <>
      <PageTitle
        title="Rentabilidad por viaje"
        subtitle="Costo operativo de cada servicio contra su tarifa de venta. El total del costo es la suma del desglose."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Venta" value={mxn(venta)} hint={`${visibles.length} servicios`} />
        <Kpi label="Costo operativo" value={mxn(costo)} />
        <Kpi
          label="Utilidad"
          value={mxn(utilidad)}
          hint={venta ? `${pct}% sobre venta` : "sin tarifa registrada"}
        />
        <Kpi
          label="En pérdida"
          value={String(enPerdida)}
          hint={enPerdida ? "el costo supera la tarifa" : "ninguno"}
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

      {visibles.length === 0 ? (
        <Card>
          <Empty>No hay servicios con este filtro.</Empty>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2.5 font-medium">Folio</th>
                <th className="px-3 py-2.5 font-medium">Ruta</th>
                <th className="px-3 py-2.5 font-medium">Estatus</th>
                <th className="px-3 py-2.5 text-right font-medium">Venta</th>
                <th className="px-3 py-2.5 text-right font-medium">Proveedor</th>
                <th className="px-3 py-2.5 text-right font-medium">Combustible</th>
                <th className="px-3 py-2.5 text-right font-medium">Casetas</th>
                <th className="px-3 py-2.5 text-right font-medium">Operador</th>
                <th className="px-3 py-2.5 text-right font-medium">Otros</th>
                <th className="px-3 py-2.5 text-right font-medium">Costo total</th>
                <th className="px-3 py-2.5 text-right font-medium">Utilidad</th>
                <th className="px-3 py-2.5 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DEE3DD]">
              {visibles.map((v) => (
                <FilaRentabilidad key={v.id} viaje={v} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

function FilaRentabilidad({ viaje: v }: { viaje: Viaje }) {
  const { actualizarCostos } = useStore();

  const [proveedor, setProveedor] = useState(String(v.costos.proveedor || ""));
  const [combustible, setCombustible] = useState(String(v.costos.combustible || ""));
  const [casetas, setCasetas] = useState(String(v.costos.casetas || ""));
  const [operador, setOperador] = useState(String(v.costos.operador || ""));
  const [otros, setOtros] = useState(String(v.costos.otros || ""));
  const [guardando, setGuardando] = useState(false);

  const capturado = {
    proveedor: Number(proveedor) || 0,
    combustible: Number(combustible) || 0,
    casetas: Number(casetas) || 0,
    operador: Number(operador) || 0,
    otros: Number(otros) || 0,
  };

  // Total en pantalla: lo que se está capturando, no lo último guardado, para
  // que la utilidad se lea antes de confirmar.
  const costoEnPantalla = Object.values(capturado).reduce((s, n) => s + n, 0);
  const utilidad = v.tarifa - costoEnPantalla;
  const pct = rentabilidad({ ...v, costo: costoEnPantalla });

  const sucio =
    capturado.proveedor !== v.costos.proveedor ||
    capturado.combustible !== v.costos.combustible ||
    capturado.casetas !== v.costos.casetas ||
    capturado.operador !== v.costos.operador ||
    capturado.otros !== v.costos.otros;

  async function guardar() {
    setGuardando(true);
    try {
      await actualizarCostos(v.id, {
        costoProveedor: capturado.proveedor,
        costoCombustible: capturado.combustible,
        costoCasetas: capturado.casetas,
        costoOperador: capturado.operador,
        costoOtros: capturado.otros,
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <tr className="hover:bg-black/[0.015]">
      <td className="px-3 py-2.5">
        <Link href={`/viajes/${v.id}`} className="font-mono font-medium text-amber hover:underline">
          {v.folio}
        </Link>
        <div className="mt-0.5">
          <AsignacionBadge asignacion={v.asignacion} />
        </div>
      </td>
      <td className="px-3 py-2.5">
        <p>
          {v.origen} <span className="text-muted">→</span> {v.destino}
        </p>
        <p className="text-xs text-muted">{v.cliente}</p>
      </td>
      <td className="px-3 py-2.5">
        <EstadoBadge estado={v.estado} />
      </td>
      <td className="px-3 py-2.5 text-right">
        {v.tarifa ? (
          mxn(v.tarifa)
        ) : (
          <span className="text-xs text-amber-800">sin tarifa</span>
        )}
      </td>

      {/* Solo FWD tiene costo de proveedor; en TDC lo ejecuta la flota propia. */}
      <td className="px-3 py-2.5 text-right">
        {v.asignacion === "FWD" ? (
          <input
            type="number"
            min={0}
            className={campo}
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
          />
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        <input
          type="number"
          min={0}
          className={campo}
          value={combustible}
          onChange={(e) => setCombustible(e.target.value)}
        />
      </td>
      <td className="px-3 py-2.5 text-right">
        <input
          type="number"
          min={0}
          className={campo}
          value={casetas}
          onChange={(e) => setCasetas(e.target.value)}
        />
      </td>
      <td className="px-3 py-2.5 text-right">
        <input
          type="number"
          min={0}
          className={campo}
          value={operador}
          onChange={(e) => setOperador(e.target.value)}
        />
      </td>
      <td className="px-3 py-2.5 text-right">
        <input
          type="number"
          min={0}
          className={campo}
          value={otros}
          onChange={(e) => setOtros(e.target.value)}
        />
      </td>

      <td className="px-3 py-2.5 text-right font-medium tabular-nums">
        {mxn(costoEnPantalla)}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        <span className={utilidad < 0 ? "font-medium text-rose-700" : "font-medium"}>
          {mxn(utilidad)}
        </span>
        <p className="text-xs text-muted">{pct === null ? "—" : `${Math.round(pct)}%`}</p>
      </td>
      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={guardar}
          disabled={!sucio || guardando}
          className="whitespace-nowrap rounded-md bg-amber px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </td>
    </tr>
  );
}

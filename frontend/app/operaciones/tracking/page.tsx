"use client";

import { useStore } from "@/lib/store";
import { Card, Empty, Kpi, PageTitle } from "@/components/ui";
import { fechaHora } from "@/lib/format";
import {
  ESTADO_LABEL,
  ESTADO_SEMAFORO,
  SEMAFORO_CLASS,
  VIAJE_ACTIVO,
} from "@/lib/types";

/**
 * Cuenta espejo de Monitoreo (Seguridad › Monitoreo), pero solo de unidades
 * propias y de solo lectura: aquí tráfico consulta, no captura. Editar
 * ubicación, estatus y los hitos del tramo se hace desde Seguridad ›
 * Monitoreo, que es el dueño de ese dato.
 */
export default function TrackingTDC() {
  const { viajes, unidad, operador } = useStore();

  const enRuta = viajes
    .filter((v) => v.asignacion === "TDC" && VIAJE_ACTIVO.includes(v.estado))
    .sort((a, b) => a.citaDescarga.localeCompare(b.citaDescarga));

  const enCamino = enRuta.filter((v) => v.estado !== "programado").length;

  return (
    <>
      <PageTitle
        title="Tracking TDC"
        subtitle="Espejo de solo lectura de Monitoreo, únicamente flota propia. Edítalo en Seguridad › Monitoreo."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Servicios activos" value={String(enRuta.length)} />
        <Kpi label="En camino" value={String(enCamino)} hint="Excluye programados" />
        <Kpi label="Programados" value={String(enRuta.length - enCamino)} />
      </div>

      <div className="mt-6">
        {enRuta.length === 0 ? (
          <Card>
            <Empty>No hay servicios TDC activos.</Empty>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Folio</th>
                    <th className="px-4 py-2.5 font-medium">Ruta</th>
                    <th className="px-4 py-2.5 font-medium">Unidad</th>
                    <th className="px-4 py-2.5 font-medium">Operador</th>
                    <th className="px-4 py-2.5 font-medium">Ubicación</th>
                    <th className="px-4 py-2.5 font-medium">Estatus</th>
                    <th className="px-4 py-2.5 font-medium">Descarga</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DEE3DD]">
                  {enRuta.map((v) => {
                    const u = unidad(v.unidadId);
                    const o = operador(v.operadorId);
                    return (
                      <tr key={v.id} className="hover:bg-black/[0.02]">
                        <td className="px-4 py-3 font-mono font-medium">{v.folio}</td>
                        <td className="px-4 py-3 text-muted">
                          {v.origen} → {v.destino}
                        </td>
                        <td className="px-4 py-3">{u ? `${u.economico} · ${u.placas}` : "—"}</td>
                        <td className="px-4 py-3 text-muted">{o?.nombre ?? "—"}</td>
                        <td className="px-4 py-3 text-muted">{v.monitoreo.ubicacion || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${SEMAFORO_CLASS[ESTADO_SEMAFORO[v.estado]]}`}
                            />
                            {ESTADO_LABEL[v.estado]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted">{fechaHora(v.citaDescarga)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

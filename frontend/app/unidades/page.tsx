"use client";

import { useStore } from "@/lib/store";
import { VIAJE_ACTIVO } from "@/lib/types";
import { Card, PageTitle } from "@/components/ui";

const claseEstado: Record<string, string> = {
  // Vocabulario del backend
  operativo: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  mantenimiento: "bg-amber-50 text-amber-800 ring-amber-200",
  fuera_servicio: "bg-rose-50 text-rose-700 ring-rose-200",
  vendido: "bg-slate-100 text-slate-700 ring-slate-200",
  // Vocabulario del modo demostración
  disponible: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  en_viaje: "bg-blue-50 text-blue-700 ring-blue-200",
  taller: "bg-amber-50 text-amber-800 ring-amber-200",
};

/** Un estado desconocido no debe quedar sin estilo. */
const CLASE_NEUTRA = "bg-slate-100 text-slate-700 ring-slate-200";

export default function Unidades() {
  const { unidades, viajes } = useStore();

  const viajeDe = (unidadId: string) =>
    viajes.find(
      (v) => v.unidadId === unidadId && VIAJE_ACTIVO.includes(v.estado),
    );

  return (
    <>
      <PageTitle
        title="Unidades"
        subtitle={`${unidades.length} unidades en la flota`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {unidades.map((u) => {
          const viaje = viajeDe(u.id);
          return (
            <Card key={u.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{u.economico}</p>
                  <p className="text-sm text-muted">{u.tipo}</p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${claseEstado[u.estado] ?? CLASE_NEUTRA}`}
                >
                  {u.estado.replace("_", " ")}
                </span>
              </div>
              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Placas</dt>
                  <dd className="font-mono text-xs">{u.placas}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Capacidad</dt>
                  <dd>{u.capacidadTon} t</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Viaje actual</dt>
                  <dd>
                    {viaje
                      ? `${viaje.folio} · ${viaje.destino}`
                      : "Sin asignación"}
                  </dd>
                </div>
              </dl>
            </Card>
          );
        })}
      </div>
    </>
  );
}

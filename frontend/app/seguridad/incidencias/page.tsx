"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Card, Empty, PageTitle } from "@/components/ui";
import { fechaHora } from "@/lib/format";
import type { IncidenciaViaje } from "@/lib/datos";

/**
 * Bitácora de incidencias reportadas a operadores desde Monitoreo (desvío
 * de ruta, estadía no autorizada, etc.). Solo lectura: el alta vive en el
 * ícono junto al operador, en Seguridad › Monitoreo.
 */
export default function Incidencias() {
  const { listarIncidencias } = useStore();
  const [incidencias, setIncidencias] = useState<IncidenciaViaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const lista = await listarIncidencias();
        if (vivo) setIncidencias(lista);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : "No se pudieron cargar las incidencias");
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [listarIncidencias]);

  return (
    <>
      <PageTitle
        title="Incidencias"
        subtitle="Reportes a operadores por desvío de ruta, estadía no autorizada u otras faltas, capturados desde Monitoreo."
      />

      {error ? (
        <Card className="mb-4 border-rose-200 bg-rose-50 p-4">
          <p className="text-sm text-rose-700">{error}</p>
        </Card>
      ) : null}

      {cargando ? (
        <Card>
          <Empty>Cargando…</Empty>
        </Card>
      ) : incidencias.length === 0 ? (
        <Card>
          <Empty>No hay incidencias registradas.</Empty>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium">Operador</th>
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Servicio</th>
                  <th className="px-4 py-2.5 font-medium">Descripción</th>
                  <th className="px-4 py-2.5 font-medium">Reportó</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE3DD]">
                {incidencias.map((i) => (
                  <tr key={i.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                      {fechaHora(i.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{i.operador || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                        {i.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {i.servicioId ? (
                        <Link
                          href={`/viajes/${i.servicioId}`}
                          className="text-amber hover:underline"
                        >
                          {i.folio}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{i.descripcion || "—"}</td>
                    <td className="px-4 py-2.5 text-muted">{i.creadoPor || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

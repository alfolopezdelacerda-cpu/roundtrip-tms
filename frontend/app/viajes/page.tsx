"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { ESTADOS_VIAJE, type Asignacion, type EstadoViaje } from "@/lib/types";
import { PageTitle } from "@/components/ui";
import {
  AsignacionBadge,
  TablaServicios,
  columnaCliente,
  columnaEstado,
  columnaFolio,
  columnaKm,
  columnaRuta,
  columnaSalida,
  columnaTarifa,
  type Columna,
} from "@/components/servicios";

/**
 * Vista transversal: todos los servicios sin importar su asignación. Las
 * secciones del menú son las vistas de trabajo; esta es la de consulta.
 */
export default function Viajes() {
  const { viajes, ejecutor } = useStore();
  const [estado, setEstado] = useState<EstadoViaje | "todos">("todos");
  const [asignacion, setAsignacion] = useState<Asignacion | "todas">("todas");

  const filtrados = viajes
    .filter((v) => (estado === "todos" ? true : v.estado === estado))
    .filter((v) => (asignacion === "todas" ? true : v.asignacion === asignacion))
    .sort((a, b) => b.salidaIda.localeCompare(a.salidaIda));

  const columnaAsignacion: Columna = {
    clave: "asignacion",
    titulo: "Asignación",
    celda: (v) => <AsignacionBadge asignacion={v.asignacion} />,
  };

  const columnaEjecutor: Columna = {
    clave: "ejecutor",
    titulo: "Ejecuta",
    celda: (v) => <span className="text-muted">{ejecutor(v)}</span>,
  };

  return (
    <>
      <PageTitle
        title="Todos los servicios"
        subtitle={`${filtrados.length} de ${viajes.length} servicios`}
        action={
          <Link
            href="/viajes/nuevo"
            className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Nuevo viaje
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={asignacion}
          onChange={(e) => setAsignacion(e.target.value as Asignacion | "todas")}
          className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber"
        >
          <option value="todas">TDC y FWD</option>
          <option value="TDC">Solo TDC</option>
          <option value="FWD">Solo FWD</option>
        </select>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as EstadoViaje | "todos")}
          className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber"
        >
          <option value="todos">Todos los estados</option>
          {ESTADOS_VIAJE.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      <TablaServicios
        viajes={filtrados}
        vacio="Ningún servicio coincide con el filtro."
        columnas={[
          columnaFolio,
          columnaRuta,
          columnaCliente,
          columnaAsignacion,
          columnaEjecutor,
          columnaSalida,
          columnaKm,
          columnaTarifa,
          columnaEstado,
        ]}
      />
    </>
  );
}

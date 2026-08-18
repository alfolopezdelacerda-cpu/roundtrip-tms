"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { PageTitle } from "@/components/ui";
import {
  TablaServicios,
  Totales,
  columnaCliente,
  columnaEstado,
  columnaFolio,
  columnaKm,
  columnaRuta,
  columnaSalida,
  columnaTarifa,
  type Columna,
} from "@/components/servicios";
import { mxn } from "@/lib/format";

/**
 * Servicios asignados a la transportadora propia: los que ejecuta la flota
 * de ADL con unidad y operador propios.
 */
export default function AsignacionTDC() {
  const { viajes, unidad, operador } = useStore();

  const propios = viajes
    .filter((v) => v.asignacion === "TDC")
    .sort((a, b) => b.salidaIda.localeCompare(a.salidaIda));

  const columnaUnidad: Columna = {
    clave: "unidad",
    titulo: "Unidad",
    celda: (v) => {
      const u = unidad(v.unidadId);
      return u ? (
        <span>
          {u.economico} <span className="text-muted">· {u.placas}</span>
        </span>
      ) : (
        <span className="text-rose-700">Sin asignar</span>
      );
    },
  };

  const columnaOperador: Columna = {
    clave: "operador",
    titulo: "Operador",
    celda: (v) => {
      const o = operador(v.operadorId);
      return o ? (
        <span className="text-muted">{o.nombre}</span>
      ) : (
        <span className="text-rose-700">Sin asignar</span>
      );
    },
  };

  const sinAsignar = propios.filter((v) => !v.unidadId || !v.operadorId).length;
  const facturacion = propios
    .filter((v) => v.estado !== "cancelado")
    .reduce((s, v) => s + v.tarifa, 0);

  return (
    <>
      <PageTitle
        title="Asignación TDC"
        subtitle="Servicios asignados a la transportadora propia."
        action={
          <Link
            href="/viajes/nuevo"
            className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Nuevo viaje
          </Link>
        }
      />

      <TablaServicios
        viajes={propios}
        vacio="No hay servicios asignados a la transportadora."
        totales={
          <Totales
            items={[
              { label: "Servicios", valor: String(propios.length) },
              { label: "Sin asignar", valor: String(sinAsignar) },
              { label: "Facturación", valor: mxn(facturacion) },
            ]}
          />
        }
        columnas={[
          columnaFolio,
          columnaRuta,
          columnaCliente,
          columnaUnidad,
          columnaOperador,
          columnaSalida,
          columnaKm,
          columnaTarifa,
          columnaEstado,
        ]}
      />
    </>
  );
}

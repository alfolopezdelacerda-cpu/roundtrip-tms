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
  columnaMargen,
  columnaRuta,
  columnaSalida,
  columnaTarifa,
  type Columna,
} from "@/components/servicios";
import { mxn } from "@/lib/format";
import { margen } from "@/lib/types";

/**
 * Servicios que NO ejecuta la transportadora propia: van con un proveedor
 * externo. Aquí importa el costo del proveedor, porque de él sale la cuenta
 * por pagar y el margen real del servicio.
 */
export default function AsignacionFWD() {
  const { viajes, proveedor } = useStore();

  const externos = viajes
    .filter((v) => v.asignacion === "FWD")
    .sort((a, b) => b.citaCarga.localeCompare(a.citaCarga));

  const columnaProveedor: Columna = {
    clave: "proveedor",
    titulo: "Proveedor",
    celda: (v) => {
      const p = proveedor(v.proveedorId);
      return p ? (
        <span>
          {p.nombre} <span className="text-muted">· {p.diasPago} días</span>
        </span>
      ) : (
        <span className="text-rose-700">Sin proveedor</span>
      );
    },
  };

  const columnaCosto: Columna = {
    clave: "costo",
    titulo: "Costo",
    alineacion: "der",
    celda: (v) => <span className="text-muted">{mxn(v.costo)}</span>,
  };

  const activos = externos.filter((v) => v.estado !== "cancelado");
  const facturacion = activos.reduce((s, v) => s + v.tarifa, 0);
  const costos = activos.reduce((s, v) => s + v.costo, 0);
  const margenTotal = activos.reduce((s, v) => s + margen(v), 0);
  const pctMargen = facturacion ? Math.round((margenTotal / facturacion) * 100) : 0;

  return (
    <>
      <PageTitle
        title="Asignación FWD"
        subtitle="Servicios cubiertos con proveedor externo."
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
        viajes={externos}
        vacio="No hay servicios asignados a proveedores externos."
        totales={
          <Totales
            items={[
              { label: "Servicios", valor: String(externos.length) },
              { label: "Costo proveedores", valor: mxn(costos) },
              { label: "Margen", valor: `${mxn(margenTotal)} (${pctMargen}%)` },
            ]}
          />
        }
        columnas={[
          columnaFolio,
          columnaRuta,
          columnaCliente,
          columnaProveedor,
          columnaSalida,
          columnaTarifa,
          columnaCosto,
          columnaMargen,
          columnaEstado,
        ]}
      />
    </>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, Empty, PageTitle } from "@/components/ui";
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
import { margen, rutaTexto } from "@/lib/types";

/**
 * Servicios que NO ejecuta la transportadora propia: van con un proveedor
 * externo. Aquí solo se elige el proveedor — el operador, la unidad, la placa
 * y el medio de comunicación reales se capturan a mano en Monitoreo, porque
 * son del proveedor y no existen en nuestros catálogos.
 */
export default function AsignacionFWD() {
  const { viajes, proveedor } = useStore();

  const externos = viajes
    .filter((v) => v.asignacion === "FWD")
    .sort((a, b) => b.citaCarga.localeCompare(a.citaCarga));

  const pendientes = externos.filter((v) => v.estado === "por_asignar");
  const asignados = externos.filter((v) => v.estado !== "por_asignar");

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
        subtitle="Elige el proveedor; al programar, el servicio pasa a Monitoreo."
        action={
          <Link
            href="/viajes/nuevo"
            className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Nuevo viaje
          </Link>
        }
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">
          Pendientes de asignación{" "}
          <span className="text-muted">({pendientes.length})</span>
        </h2>
        {pendientes.length === 0 ? (
          <Card>
            <Empty>No hay servicios FWD esperando proveedor.</Empty>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pendientes.map((v) => (
              <TarjetaAsignacion key={v.id} viajeId={v.id} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Asignados <span className="text-muted">({asignados.length})</span>
        </h2>
        <TablaServicios
          viajes={asignados}
          vacio="No hay servicios FWD programados todavía."
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
      </section>
    </>
  );
}

function TarjetaAsignacion({ viajeId }: { viajeId: string }) {
  const { viajes, proveedores, asignar, cambiarEstado, nombreDe } = useStore();
  const v = viajes.find((x) => x.id === viajeId);

  const [proveedorId, setProveedorId] = useState(v?.proveedorId ?? "");
  const [costo, setCosto] = useState(
    v?.costos.proveedor ? String(v.costos.proveedor) : "",
  );
  const [guardando, setGuardando] = useState(false);
  const [programando, setProgramando] = useState(false);

  if (!v) return null;

  const activos = proveedores.filter((p) => p.activo);
  const listo = Boolean(proveedorId);

  async function guardar() {
    setGuardando(true);
    try {
      await asignar(viajeId, {
        proveedorId,
        costoProveedor: Number(costo) || 0,
      });
    } finally {
      setGuardando(false);
    }
  }

  async function programar() {
    setProgramando(true);
    try {
      await asignar(viajeId, {
        proveedorId,
        costoProveedor: Number(costo) || 0,
      });
      await cambiarEstado(viajeId, "programado");
    } finally {
      setProgramando(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-semibold">{v.folio}</p>
          <p className="text-sm text-muted">{rutaTexto(v)}</p>
          <p className="text-xs text-muted">{v.cliente || nombreDe("clientes", v.clienteId)}</p>
        </div>
        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
          Por asignar
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Proveedor
          </label>
          <select
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber"
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
          >
            <option value="">Seleccionar proveedor</option>
            {activos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {p.tipo.replace("_", " ")} ({p.diasPago} días)
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Costo del proveedor (MXN)
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber"
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
          />
        </div>
      </div>

      <p className="mt-2 text-xs text-muted">
        Operador, medio de comunicación, unidad y placa se capturan a mano cuando el
        servicio caiga en Monitoreo.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || programando}
          className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar asignación"}
        </button>
        <button
          type="button"
          onClick={programar}
          disabled={!listo || guardando || programando}
          className="rounded-md bg-amber px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {programando ? "Programando…" : "Programar Servicio"}
        </button>
      </div>
      {!listo ? (
        <p className="mt-2 text-xs text-muted">Elige un proveedor para poder programar el servicio.</p>
      ) : null}
    </Card>
  );
}

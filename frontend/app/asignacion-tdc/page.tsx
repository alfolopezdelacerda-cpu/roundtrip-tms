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
  columnaKm,
  columnaRuta,
  columnaSalida,
  columnaTarifa,
  type Columna,
} from "@/components/servicios";
import { mxn } from "@/lib/format";
import { operadorDisponible, rutaTexto, unidadDisponible } from "@/lib/types";

/**
 * Servicios asignados a la transportadora propia: los que ejecuta la flota
 * de ADL con unidad y operador propios.
 *
 * "Pendientes de asignación" es donde se elige el económico y el operador;
 * solo al hacer clic en "Programar Servicio" el viaje pasa a Monitoreo.
 */
export default function AsignacionTDC() {
  const { viajes, unidad, operador } = useStore();

  const propios = viajes
    .filter((v) => v.asignacion === "TDC")
    .sort((a, b) => b.citaCarga.localeCompare(a.citaCarga));

  const pendientes = propios.filter((v) => v.estado === "por_asignar");
  const asignados = propios.filter((v) => v.estado !== "por_asignar");

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

  const facturacion = propios
    .filter((v) => v.estado !== "cancelado")
    .reduce((s, v) => s + v.tarifa, 0);

  return (
    <>
      <PageTitle
        title="Asignación TDC"
        subtitle="Elige el económico de la flota propia y el operador; al programar, el servicio pasa a Monitoreo."
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
            <Empty>No hay servicios TDC esperando unidad y operador.</Empty>
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
          vacio="No hay servicios TDC programados todavía."
          totales={
            <Totales
              items={[
                { label: "Servicios", valor: String(propios.length) },
                { label: "Por asignar", valor: String(pendientes.length) },
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
      </section>
    </>
  );
}

function TarjetaAsignacion({ viajeId }: { viajeId: string }) {
  const { viajes, unidades, operadores, asignar, cambiarEstado, nombreDe } = useStore();
  const v = viajes.find((x) => x.id === viajeId);

  const [unidadId, setUnidadId] = useState(v?.unidadId ?? "");
  const [operadorId, setOperadorId] = useState(v?.operadorId ?? "");
  const [km, setKm] = useState(v?.km ? String(v.km) : "");
  const [tarifa, setTarifa] = useState(v?.tarifa ? String(v.tarifa) : "");
  const [costo, setCosto] = useState(v?.costo ? String(v.costo) : "");
  const [guardando, setGuardando] = useState(false);
  const [programando, setProgramando] = useState(false);

  if (!v) return null;

  const flota = unidades.filter((u) => u.activo);
  const plantilla = operadores.filter((o) => o.activo);

  const listo = Boolean(unidadId && operadorId);

  async function guardar() {
    setGuardando(true);
    try {
      await asignar(viajeId, {
        unidadId,
        operadorId,
        km: Number(km) || 0,
        tarifa: Number(tarifa) || 0,
        costo: Number(costo) || 0,
      });
    } finally {
      setGuardando(false);
    }
  }

  async function programar() {
    setProgramando(true);
    try {
      await asignar(viajeId, {
        unidadId,
        operadorId,
        km: Number(km) || 0,
        tarifa: Number(tarifa) || 0,
        costo: Number(costo) || 0,
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
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Unidad (flota propia)
          </label>
          <select
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber"
            value={unidadId}
            onChange={(e) => setUnidadId(e.target.value)}
          >
            <option value="">Seleccionar unidad</option>
            {flota.map((u) => (
              <option key={u.id} value={u.id}>
                {u.economico} — {u.tipo} · {u.placas}
                {unidadDisponible(u) ? "" : ` (${u.estado})`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Operador
          </label>
          <select
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber"
            value={operadorId}
            onChange={(e) => setOperadorId(e.target.value)}
          >
            <option value="">Seleccionar operador</option>
            {plantilla.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre} · {o.licencia}
                {operadorDisponible(o) ? "" : ` (${o.estado})`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Kilómetros
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber"
            value={km}
            onChange={(e) => setKm(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Tarifa al cliente (MXN)
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber"
            value={tarifa}
            onChange={(e) => setTarifa(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Costo operativo (MXN)
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
        <p className="mt-2 text-xs text-muted">
          Elige unidad y operador para poder programar el servicio.
        </p>
      ) : null}
    </Card>
  );
}


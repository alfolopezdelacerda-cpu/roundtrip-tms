"use client";

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
import { operadorDisponible, rutaTexto } from "@/lib/types";

/**
 * Servicios asignados a la transportadora propia: los que ejecuta la flota
 * de ADL con unidad y operador propios.
 *
 * "Pendientes de asignación" es donde se completa unidad, operador y ruta;
 * al guardar, el servicio pasa a "programado" en un solo paso y aparece en
 * Seguridad › Monitoreo.
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
        subtitle="Unidad, operador y código de ruta de la flota propia; al guardar, el servicio se programa solo."
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
  const { viajes, unidades, operadores, rutas, asignar, cambiarEstado, nombreDe } = useStore();
  const v = viajes.find((x) => x.id === viajeId);

  const [unidadId, setUnidadId] = useState(v?.unidadId ?? "");
  const [operadorId, setOperadorId] = useState(v?.operadorId ?? "");
  const [rutaId, setRutaId] = useState(v?.rutaId ?? "");
  const [guardando, setGuardando] = useState(false);

  if (!v) return null;

  const flota = unidades.filter((u) => u.activo);
  const plantilla = operadores.filter((o) => o.activo);
  const rutasActivas = rutas.filter((r) => r.activo);

  const unidadElegida = flota.find((u) => u.id === unidadId);
  const rutaElegida = rutasActivas.find((r) => r.id === rutaId);

  const listo = Boolean(unidadId && operadorId && rutaId);

  async function guardar() {
    setGuardando(true);
    try {
      // Un solo paso: asignar y programar, tal como opera tráfico.
      await asignar(viajeId, { unidadId, operadorId, rutaId });
      await cambiarEstado(viajeId, "programado");
    } finally {
      setGuardando(false);
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
            Unidad (económico)
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

        {/* Tipo de unidad y placas: automáticos, de Flota. No se capturan aquí. */}
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Tipo de unidad
          </label>
          <p className="rounded-md bg-black/[0.03] px-3 py-2 text-sm text-muted">
            {unidadElegida?.tipo ?? "—"}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Placas
          </label>
          <p className="rounded-md bg-black/[0.03] px-3 py-2 text-sm text-muted">
            {unidadElegida?.placas ?? "—"}
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Código de ruta
          </label>
          <select
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber"
            value={rutaId}
            onChange={(e) => setRutaId(e.target.value)}
          >
            <option value="">Seleccionar ruta</option>
            {rutasActivas.map((r) => (
              <option key={r.id} value={r.id}>
                {r.codigo} — {r.origen} → {r.destino}
              </option>
            ))}
          </select>
        </div>

        {/* Km y casetas: automáticos, de la ruta elegida. */}
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Kilómetros proyectados
          </label>
          <p className="rounded-md bg-black/[0.03] px-3 py-2 text-sm text-muted">
            {rutaElegida ? rutaElegida.kmProyectados : "—"}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Casetas proyectadas
          </label>
          <p className="rounded-md bg-black/[0.03] px-3 py-2 text-sm text-muted">
            {rutaElegida ? mxn(rutaElegida.casetasProyectadas) : "—"}
          </p>
        </div>

      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={guardar}
          disabled={!listo || guardando}
          className="rounded-md bg-amber px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar y programar"}
        </button>
      </div>
      {!listo ? (
        <p className="mt-2 text-xs text-muted">
          Elige unidad, operador y código de ruta para poder guardar.
        </p>
      ) : null}
    </Card>
  );
}

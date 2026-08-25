"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, Empty, PageTitle } from "@/components/ui";
import { mxn } from "@/lib/format";

const campo =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-amber";

/**
 * Tarifario de venta: cuánto se le cobra a cada cliente por cada tramo.
 *
 * Es el único lugar donde se define la tarifa. Al dar de alta un servicio,
 * el sistema busca aquí la que corresponde a su cliente, origen y destino y
 * la copia; por eso Asignación ya no la pide.
 */
export default function Tarifas() {
  const { tarifas, clientes, viajes, actualizarCatalogo } = useStore();
  const [nueva, setNueva] = useState(false);
  const [filtroCliente, setFiltroCliente] = useState("");

  const visibles = tarifas
    .filter((t) => (filtroCliente ? t.clienteId === filtroCliente : true))
    .sort(
      (a, b) =>
        a.cliente.localeCompare(b.cliente) ||
        a.origen.localeCompare(b.origen) ||
        a.destino.localeCompare(b.destino),
    );

  /**
   * Tramos que ya se operaron sin tarifa registrada. Son los servicios que
   * van a llegar a CXC en cero, así que conviene verlos aquí y no al cobrar.
   */
  const sinTarifa = viajes
    .filter((v) => v.estado !== "cancelado" && !v.tarifa)
    .map((v) => `${v.cliente} · ${v.origen} → ${v.destino}`);
  const tramosSinTarifa = [...new Set(sinTarifa)];

  return (
    <>
      <PageTitle
        title="Tarifas"
        subtitle="Tarifa de venta por cliente y tramo. De aquí sale lo que se le cobra a cada servicio."
        action={
          <button
            onClick={() => setNueva((v) => !v)}
            className="rounded-md bg-amber px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {nueva ? "Cancelar" : "+ Nueva tarifa"}
          </button>
        }
      />

      {nueva ? (
        <Card className="mb-4 p-4">
          <FormularioTarifa onCerrar={() => setNueva(false)} />
        </Card>
      ) : null}

      {tramosSinTarifa.length > 0 ? (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            {tramosSinTarifa.length} tramo(s) operados sin tarifa registrada
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-amber-800">
            {tramosSinTarifa.slice(0, 6).map((t) => (
              <li key={t}>{t}</li>
            ))}
            {tramosSinTarifa.length > 6 ? (
              <li>… y {tramosSinTarifa.length - 6} más</li>
            ) : null}
          </ul>
          <p className="mt-2 text-xs text-amber-800">
            Esos servicios llegan a CXC en cero hasta que se les dé de alta la tarifa
            y se vuelva a guardar el servicio.
          </p>
        </Card>
      ) : null}

      <div className="mb-4">
        <select
          className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber"
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
        >
          <option value="">Todos los clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {visibles.length === 0 ? (
        <Card>
          <Empty>No hay tarifas registradas con este filtro.</Empty>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Origen</th>
                  <th className="px-4 py-2.5 font-medium">Destino</th>
                  <th className="px-4 py-2.5 text-right font-medium">Tarifa de venta</th>
                  <th className="px-4 py-2.5 font-medium">Activa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE3DD]">
                {visibles.map((t) => (
                  <tr key={t.id} className={t.activo ? "" : "opacity-50"}>
                    <td className="px-4 py-2.5 font-medium">{t.cliente}</td>
                    <td className="px-4 py-2.5 text-muted">{t.origen}</td>
                    <td className="px-4 py-2.5 text-muted">{t.destino}</td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        className="w-32 rounded-md border border-line bg-white px-2 py-1 text-right text-sm outline-none focus:border-amber"
                        defaultValue={t.tarifaVenta}
                        onBlur={(e) => {
                          const valor = Number(e.target.value) || 0;
                          if (valor !== t.tarifaVenta) {
                            void actualizarCatalogo("tarifas", t.id, {
                              tarifaVenta: valor,
                            });
                          }
                        }}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={t.activo}
                        onChange={(e) =>
                          actualizarCatalogo("tarifas", t.id, { activo: e.target.checked })
                        }
                        className="h-4 w-4 accent-[#C97A0F]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="mt-4 text-xs text-muted">
        Total del tarifario visible:{" "}
        {mxn(visibles.reduce((s, t) => s + t.tarifaVenta, 0))} en{" "}
        {visibles.length} tramo(s).
      </p>
    </>
  );
}

function FormularioTarifa({ onCerrar }: { onCerrar: () => void }) {
  const { clientes, agregarCatalogo } = useStore();
  const [form, setForm] = useState({
    clienteId: "",
    origen: "",
    destino: "",
    tarifaVenta: "",
  });
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clienteId || !form.origen.trim() || !form.destino.trim()) {
      setAviso("Cliente, origen y destino son obligatorios.");
      return;
    }

    setGuardando(true);
    setAviso(null);
    try {
      // Solo se cierra si el alta prosperó: el backend rechaza un tramo que ya
      // tiene tarifa, y cerrar el formulario ahí borraría lo capturado.
      const ok = await agregarCatalogo("tarifas", {
        clienteId: form.clienteId,
        origen: form.origen.trim(),
        destino: form.destino.trim(),
        tarifaVenta: Number(form.tarifaVenta) || 0,
      });
      if (ok) onCerrar();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Campo label="Cliente">
        <select
          className={campo}
          value={form.clienteId}
          onChange={(e) => set("clienteId")(e.target.value)}
        >
          <option value="">Seleccionar cliente</option>
          {clientes
            .filter((c) => c.activo)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
        </select>
      </Campo>
      <Campo label="Origen">
        <input
          className={campo}
          value={form.origen}
          onChange={(e) => set("origen")(e.target.value)}
          placeholder="CDMX"
        />
      </Campo>
      <Campo label="Destino">
        <input
          className={campo}
          value={form.destino}
          onChange={(e) => set("destino")(e.target.value)}
          placeholder="Monterrey"
        />
      </Campo>
      <Campo label="Tarifa de venta (MXN)">
        <input
          type="number"
          min={0}
          className={campo}
          value={form.tarifaVenta}
          onChange={(e) => set("tarifaVenta")(e.target.value)}
        />
      </Campo>

      {aviso ? (
        <p className="sm:col-span-2 lg:col-span-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          {aviso}
        </p>
      ) : null}

      <div className="sm:col-span-2 lg:col-span-4">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-amber px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar tarifa"}
        </button>
      </div>
    </form>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

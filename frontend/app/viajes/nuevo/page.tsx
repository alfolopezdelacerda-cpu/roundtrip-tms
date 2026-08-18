"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { ESTADOS_VIAJE, type Asignacion, type EstadoViaje } from "@/lib/types";
import { Card, PageTitle } from "@/components/ui";

const campo =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber";
const etiqueta = "mb-1 block text-xs font-medium uppercase tracking-wide text-muted";

export default function NuevoViaje() {
  const router = useRouter();
  const { unidades, operadores, proveedores, agregarViaje } = useStore();

  const [form, setForm] = useState({
    cliente: "",
    origen: "",
    destino: "",
    salidaIda: "",
    retornoEstimado: "",
    asignacion: "TDC" as Asignacion,
    unidadId: "",
    operadorId: "",
    proveedorId: "",
    estado: "programado" as EstadoViaje,
    kmRedondo: "",
    tarifa: "",
    costo: "",
    diasCredito: "30",
    notas: "",
  });
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }) as typeof form);

  const esTDC = form.asignacion === "TDC";

  function guardar(e: React.FormEvent) {
    e.preventDefault();

    if (!form.cliente || !form.origen || !form.destino || !form.salidaIda) {
      setError("Cliente, origen, destino y fecha de salida son obligatorios.");
      return;
    }
    if (form.retornoEstimado && form.retornoEstimado < form.salidaIda) {
      setError("El retorno no puede ser anterior a la salida.");
      return;
    }
    if (!esTDC && !form.proveedorId) {
      setError("Un servicio FWD necesita proveedor asignado.");
      return;
    }

    const creado = agregarViaje({
      cliente: form.cliente.trim(),
      origen: form.origen.trim(),
      destino: form.destino.trim(),
      salidaIda: form.salidaIda,
      retornoEstimado: form.retornoEstimado || form.salidaIda,
      estado: form.estado,
      kmRedondo: Number(form.kmRedondo) || 0,
      asignacion: form.asignacion,
      // Los campos de la otra vía se guardan vacíos, no con datos huérfanos.
      unidadId: esTDC ? form.unidadId : "",
      operadorId: esTDC ? form.operadorId : "",
      proveedorId: esTDC ? "" : form.proveedorId,
      tarifa: Number(form.tarifa) || 0,
      costo: Number(form.costo) || 0,
      cobro: {
        estado: "pendiente",
        factura: null,
        fechaFactura: null,
        diasCredito: Number(form.diasCredito) || 30,
      },
      pago: { estado: "pendiente", referencia: null, fechaPago: null },
      liquidacion: { estado: "pendiente", fecha: null },
      monitoreo: {
        avance: 0,
        ubicacion: form.origen.trim(),
        ultimoEvento: "Servicio dado de alta",
        actualizado: new Date().toISOString(),
      },
      notas: form.notas.trim() || undefined,
    });

    router.push(`/viajes/${creado.id}`);
  }

  return (
    <>
      <PageTitle
        title="Nuevo Viaje"
        subtitle="El folio se asigna automáticamente al guardar."
      />

      <Card className="max-w-3xl p-5">
        <form onSubmit={guardar} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={etiqueta}>Cliente *</label>
            <input
              className={campo}
              value={form.cliente}
              onChange={(e) => set("cliente")(e.target.value)}
              placeholder="Grupo Ferretero del Norte"
            />
          </div>

          <div>
            <label className={etiqueta}>Origen *</label>
            <input
              className={campo}
              value={form.origen}
              onChange={(e) => set("origen")(e.target.value)}
              placeholder="CDMX"
            />
          </div>
          <div>
            <label className={etiqueta}>Destino *</label>
            <input
              className={campo}
              value={form.destino}
              onChange={(e) => set("destino")(e.target.value)}
              placeholder="Monterrey"
            />
          </div>

          <div>
            <label className={etiqueta}>Salida (ida) *</label>
            <input
              type="date"
              className={campo}
              value={form.salidaIda}
              onChange={(e) => set("salidaIda")(e.target.value)}
            />
          </div>
          <div>
            <label className={etiqueta}>Retorno estimado</label>
            <input
              type="date"
              className={campo}
              value={form.retornoEstimado}
              onChange={(e) => set("retornoEstimado")(e.target.value)}
            />
          </div>

          {/* La asignación decide el resto del flujo: liquidación al operador
              (TDC) o cuenta por pagar al proveedor (FWD). */}
          <div className="sm:col-span-2">
            <label className={etiqueta}>Asignación *</label>
            <div className="flex flex-wrap gap-2">
              {(["TDC", "FWD"] as const).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => set("asignacion")(op)}
                  className={`rounded-md px-3 py-2 text-sm ring-1 ring-inset transition-colors ${
                    form.asignacion === op
                      ? "bg-ink text-white ring-transparent"
                      : "bg-white ring-[#DEE3DD] hover:bg-black/[0.03]"
                  }`}
                >
                  {op === "TDC" ? "TDC · Transportadora" : "FWD · Proveedor externo"}
                </button>
              ))}
            </div>
          </div>

          {esTDC ? (
            <>
              <div>
                <label className={etiqueta}>Unidad</label>
                <select
                  className={campo}
                  value={form.unidadId}
                  onChange={(e) => set("unidadId")(e.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.economico} — {u.tipo}
                      {u.estado === "disponible" ? "" : ` (${u.estado})`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={etiqueta}>Operador</label>
                <select
                  className={campo}
                  value={form.operadorId}
                  onChange={(e) => set("operadorId")(e.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {operadores.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                      {o.estado === "disponible" ? "" : ` (${o.estado})`}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2">
              <label className={etiqueta}>Proveedor *</label>
              <select
                className={campo}
                value={form.proveedorId}
                onChange={(e) => set("proveedorId")(e.target.value)}
              >
                <option value="">Seleccionar proveedor</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — {p.tipo.replace("_", " ")} ({p.diasPago} días)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={etiqueta}>Kilómetros (redondo)</label>
            <input
              type="number"
              min={0}
              className={campo}
              value={form.kmRedondo}
              onChange={(e) => set("kmRedondo")(e.target.value)}
              placeholder="1720"
            />
          </div>
          <div>
            <label className={etiqueta}>Días de crédito</label>
            <input
              type="number"
              min={0}
              className={campo}
              value={form.diasCredito}
              onChange={(e) => set("diasCredito")(e.target.value)}
            />
          </div>

          <div>
            <label className={etiqueta}>Tarifa al cliente (MXN)</label>
            <input
              type="number"
              min={0}
              className={campo}
              value={form.tarifa}
              onChange={(e) => set("tarifa")(e.target.value)}
              placeholder="48500"
            />
          </div>
          <div>
            <label className={etiqueta}>
              {esTDC ? "Costo operativo (MXN)" : "Costo del proveedor (MXN)"}
            </label>
            <input
              type="number"
              min={0}
              className={campo}
              value={form.costo}
              onChange={(e) => set("costo")(e.target.value)}
              placeholder="31400"
            />
          </div>

          <div>
            <label className={etiqueta}>Estado inicial</label>
            <select
              className={campo}
              value={form.estado}
              onChange={(e) => set("estado")(e.target.value)}
            >
              {ESTADOS_VIAJE.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={etiqueta}>Notas</label>
            <textarea
              rows={3}
              className={campo}
              value={form.notas}
              onChange={(e) => set("notas")(e.target.value)}
              placeholder="Retorno con carga de compensación…"
            />
          </div>

          {error ? (
            <p className="sm:col-span-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-amber px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Guardar viaje
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-black/[0.03]"
            >
              Cancelar
            </button>
          </div>
        </form>
      </Card>
    </>
  );
}

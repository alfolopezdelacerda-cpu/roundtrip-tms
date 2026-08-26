"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { Asignacion, Modalidad, Temperatura } from "@/lib/types";
import { Card, PageTitle } from "@/components/ui";

const campo =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber";
const etiqueta = "mb-1 block text-xs font-medium uppercase tracking-wide text-muted";

export default function NuevoViaje() {
  const router = useRouter();
  const {
    clientes,
    puertos,
    tiposNegocio,
    tiposUnidad,
    tiposMercancia,
    agregarViaje,
    esFull,
  } = useStore();

  const [form, setForm] = useState({
    clienteId: "",
    origen: "",
    destino: "",
    puertoId: "",
    citaCarga: "",
    citaDescarga: "",
    asignacion: "TDC" as Asignacion,
    tipoNegocioId: "",
    temperatura: "SECO" as Temperatura,
    modalidad: "RT" as Modalidad,
    tipoUnidadId: "",
    contenedor1: "",
    contenedor2: "",
    tipoMercanciaId: "",
    booking: "",
    po: "",
    notas: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }) as typeof form);

  const admiteSegundoContenedor = esFull(form.tipoUnidadId);

  const activos = <T extends { activo: boolean }>(lista: T[]) =>
    lista.filter((i) => i.activo);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();

    // Obligatorios marcados con * en la especificación del alta.
    if (!form.origen || !form.destino || !form.puertoId) {
      setError("Origen, destino y puerto son obligatorios.");
      return;
    }
    if (!form.clienteId) {
      setError("Falta seleccionar el cliente.");
      return;
    }
    if (!form.citaCarga) {
      setError("Falta la cita de carga.");
      return;
    }
    if (form.citaDescarga && form.citaDescarga < form.citaCarga) {
      setError("La cita de descarga no puede ser anterior a la de carga.");
      return;
    }

    const cliente = clientes.find((c) => c.id === form.clienteId);

    setGuardando(true);
    try {
      const creado = await agregarViaje({
        clienteId: form.clienteId,
        cliente: cliente?.nombre ?? "",
        origen: form.origen.trim(),
        destino: form.destino.trim(),
        puertoId: form.puertoId,
        citaCarga: form.citaCarga,
        citaDescarga: form.citaDescarga || form.citaCarga,
        asignacion: form.asignacion,
        // La unidad/operador (TDC) o el proveedor (FWD) se eligen después, en
        // Asignación TDC/FWD: el servicio nace "por asignar".
        unidadId: "",
        operadorId: "",
        proveedorId: "",
        rutaId: "",
        rutaCodigo: "",
        tipoNegocioId: form.tipoNegocioId,
        temperatura: form.temperatura,
        modalidad: form.modalidad,
        tipoUnidadId: form.tipoUnidadId,
        tipoMercanciaId: form.tipoMercanciaId,
        contenedor1: form.contenedor1.trim(),
        contenedor2: admiteSegundoContenedor ? form.contenedor2.trim() : "",
        booking: form.booking.trim(),
        po: form.po.trim(),
        estado: "por_asignar",
        km: 0,
        casetasProyectadas: 0,
        // La tarifa la resuelve el tarifario de Ventas según cliente y tramo;
        // el costo se captura después en Finanzas › Rentabilidad por viaje.
        tarifa: 0,
        costo: 0,
        costos: { proveedor: 0, combustible: 0, casetas: 0, operador: 0, otros: 0 },
        cobro: {
          estado: "pendiente",
          factura: null,
          fechaFactura: null,
          diasCredito: cliente?.diasCredito ?? 30,
        },
        pago: { estado: "pendiente", referencia: null, fechaPago: null },
        liquidacion: {
          estado: "pendiente",
          fecha: null,
          combustible: 0,
          casetas: 0,
          gastosExtra: 0,
          gastosExtraDetalle: null,
          evidencias: false,
        },
        monitoreo: {
          avance: 0,
          ubicacion: form.origen.trim(),
          ultimoEvento: "Servicio dado de alta, pendiente de asignar",
          actualizado: new Date().toISOString(),
          operadorManual: "",
          medioComunicacion: "",
          unidadManual: "",
          placaManual: "",
          observaciones: "",
          cuentaEspejo: "",
          referencia: "",
          salidaPatio: "",
          arriboCarga: "",
          ingresoCargar: "",
          inicioRuta: "",
          arriboDestino: "",
          ingresoDescarga: "",
          servicioFinalizado: "",
        },
        notas: form.notas.trim() || undefined,
      });

      router.push(`/viajes/${creado.id}`);
    } catch (err) {
      // El backend valida más que el formulario (claves de catálogo, fechas):
      // su mensaje es el que hay que mostrar.
      setError(err instanceof Error ? err.message : "No se pudo guardar el viaje");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <PageTitle
        title="Asignación de Servicio"
        subtitle="Al asignar, el servicio queda «Por asignar»: folio y carta porte salen automáticos, y la unidad, el operador o el proveedor se eligen en Asignación TDC/FWD."
      />

      <Card className="max-w-4xl p-5">
        <form onSubmit={guardar} className="space-y-6">
          <Seccion titulo="Servicio">
            <Campo label="Cliente *" ancho="full">
              <select
                className={campo}
                value={form.clienteId}
                onChange={(e) => set("clienteId")(e.target.value)}
              >
                <option value="">Seleccionar cliente</option>
                {activos(clientes).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Origen *">
              <input
                className={campo}
                value={form.origen}
                onChange={(e) => set("origen")(e.target.value)}
                placeholder="CDMX"
              />
            </Campo>
            <Campo label="Destino *">
              <input
                className={campo}
                value={form.destino}
                onChange={(e) => set("destino")(e.target.value)}
                placeholder="Monterrey"
              />
            </Campo>
            <Campo label="Puerto *">
              <select
                className={campo}
                value={form.puertoId}
                onChange={(e) => set("puertoId")(e.target.value)}
              >
                <option value="">Seleccionar puerto</option>
                {activos(puertos).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Cita de carga *">
              <input
                type="datetime-local"
                className={campo}
                value={form.citaCarga}
                onChange={(e) => set("citaCarga")(e.target.value)}
              />
            </Campo>
            <Campo label="Cita de descarga">
              <input
                type="datetime-local"
                className={campo}
                value={form.citaDescarga}
                onChange={(e) => set("citaDescarga")(e.target.value)}
              />
            </Campo>
          </Seccion>

          <Seccion titulo="Asignación">
            {/* Decide el resto del flujo: liquidación al operador (TDC) o
                cuenta por pagar al proveedor (FWD). La unidad/operador o el
                proveedor se eligen después, en Asignación TDC/FWD. */}
            <Campo label="Asignación *" ancho="full">
              <div className="flex flex-wrap gap-2">
                {(["TDC", "FWD"] as const).map((op) => (
                  <Opcion
                    key={op}
                    activo={form.asignacion === op}
                    onClick={() => set("asignacion")(op)}
                  >
                    {op === "TDC" ? "TDC · Transportadora" : "FWD · Proveedor externo"}
                  </Opcion>
                ))}
              </div>
            </Campo>
          </Seccion>

          <Seccion titulo="Carga">
            <Campo label="Tipo de negocio">
              <select
                className={campo}
                value={form.tipoNegocioId}
                onChange={(e) => set("tipoNegocioId")(e.target.value)}
              >
                <option value="">Seleccionar</option>
                {activos(tiposNegocio).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="RF / Seco">
              <div className="flex gap-2">
                {(["RF", "SECO"] as const).map((op) => (
                  <Opcion
                    key={op}
                    activo={form.temperatura === op}
                    onClick={() => set("temperatura")(op)}
                  >
                    {op === "RF" ? "RF · Refrigerado" : "Seco"}
                  </Opcion>
                ))}
              </div>
            </Campo>

            <Campo label="OW / RT">
              <div className="flex gap-2">
                {(["OW", "RT"] as const).map((op) => (
                  <Opcion
                    key={op}
                    activo={form.modalidad === op}
                    onClick={() => set("modalidad")(op)}
                  >
                    {op === "OW" ? "OW · One way" : "RT · Round trip"}
                  </Opcion>
                ))}
              </div>
            </Campo>

            <Campo label="Tipo de unidad">
              <select
                className={campo}
                value={form.tipoUnidadId}
                onChange={(e) => set("tipoUnidadId")(e.target.value)}
              >
                <option value="">Seleccionar</option>
                {activos(tiposUnidad).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                    {t.full ? " (full)" : ""}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Tipo de mercancía">
              <select
                className={campo}
                value={form.tipoMercanciaId}
                onChange={(e) => set("tipoMercanciaId")(e.target.value)}
              >
                <option value="">Seleccionar</option>
                {activos(tiposMercancia).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Contenedor 1">
              <input
                className={campo}
                value={form.contenedor1}
                onChange={(e) => set("contenedor1")(e.target.value)}
                placeholder="MSCU-4471203"
              />
            </Campo>

            {/* El segundo contenedor solo aplica si la unidad es full. */}
            <Campo label="Contenedor 2">
              <input
                className={campo}
                value={admiteSegundoContenedor ? form.contenedor2 : ""}
                onChange={(e) => set("contenedor2")(e.target.value)}
                disabled={!admiteSegundoContenedor}
                placeholder={
                  admiteSegundoContenedor ? "MSCU-4471204" : "Solo para unidad full"
                }
              />
            </Campo>

            <Campo label="Booking">
              <input
                className={campo}
                value={form.booking}
                onChange={(e) => set("booking")(e.target.value)}
                placeholder="BKG-556201"
              />
            </Campo>
            <Campo label="PO">
              <input
                className={campo}
                value={form.po}
                onChange={(e) => set("po")(e.target.value)}
                placeholder="PO-88231"
              />
            </Campo>

            <Campo label="Notas" ancho="full">
              <textarea
                rows={2}
                className={campo}
                value={form.notas}
                onChange={(e) => set("notas")(e.target.value)}
                placeholder="Retorno con carga de compensación…"
              />
            </Campo>
          </Seccion>

          {error ? (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-amber px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {guardando ? "Asignando…" : "Asignar"}
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

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">{titulo}</legend>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function Campo({
  label,
  ancho,
  children,
}: {
  label: string;
  ancho?: "full";
  children: ReactNode;
}) {
  return (
    <div className={ancho === "full" ? "sm:col-span-2 lg:col-span-3" : undefined}>
      <label className={etiqueta}>{label}</label>
      {children}
    </div>
  );
}

function Opcion({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm ring-1 ring-inset transition-colors ${
        activo
          ? "bg-ink text-white ring-transparent"
          : "bg-white ring-[#DEE3DD] hover:bg-black/[0.03]"
      }`}
    >
      {children}
    </button>
  );
}

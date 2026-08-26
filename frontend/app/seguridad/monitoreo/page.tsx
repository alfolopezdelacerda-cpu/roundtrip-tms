"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Card, Empty, Kpi, PageTitle } from "@/components/ui";
import { fechaHora } from "@/lib/format";
import {
  ESTADO_LABEL,
  ESTADO_SEMAFORO,
  ESTADOS_VIAJE,
  HITOS_MONITOREO,
  SEMAFORO_CLASS,
  VIAJE_ACTIVO,
  type Asignacion,
  type EstadoViaje,
  type Viaje,
} from "@/lib/types";
import type { NuevaIncidencia } from "@/lib/datos";

/**
 * Seguimiento de viaje de ambos orígenes (TDC y FWD) en una tabla única.
 *
 * En TDC unidad, placas y operador vienen del catálogo (de la asignación);
 * en FWD son manuales porque son datos del proveedor, igual que el medio de
 * comunicación y la cuenta espejo. Ubicación, estatus, observaciones y los
 * siete hitos del tramo (de salida de patio a servicio finalizado) siempre
 * son manuales: tráfico los captura conforme van ocurriendo.
 */
export default function Monitoreo() {
  const { viajes, clientes, proveedores, nombreDe } = useStore();
  const [filtro, setFiltro] = useState<Asignacion | "todos">("todos");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroLT, setFiltroLT] = useState("");
  const [filtroUnidad, setFiltroUnidad] = useState("");

  const activos = viajes.filter((v) => VIAJE_ACTIVO.includes(v.estado));
  const enRuta = activos
    .filter((v) => (filtro === "todos" ? true : v.asignacion === filtro))
    .filter((v) => (filtroCliente ? v.clienteId === filtroCliente : true))
    .filter((v) => {
      if (!filtroLT) return true;
      if (filtroLT === "propia") return v.asignacion === "TDC";
      return v.asignacion === "FWD" && v.proveedorId === filtroLT;
    })
    .filter((v) => {
      if (!filtroUnidad.trim()) return true;
      const buscado = filtroUnidad.trim().toLowerCase();
      const unidad =
        v.asignacion === "TDC"
          ? nombreDe("unidades", v.unidadId)
          : v.monitoreo.unidadManual;
      return unidad.toLowerCase().includes(buscado);
    })
    .sort((a, b) => a.citaDescarga.localeCompare(b.citaDescarga));

  const tdc = activos.filter((v) => v.asignacion === "TDC").length;
  const fwd = activos.filter((v) => v.asignacion === "FWD").length;
  const enCamino = activos.filter((v) => v.estado !== "programado").length;

  return (
    <>
      <PageTitle
        title="Monitoreo"
        subtitle="Seguimiento de servicios en curso, propios y de proveedor."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Servicios activos" value={String(activos.length)} />
        <Kpi label="En camino" value={String(enCamino)} hint="Excluye programados" />
        <Kpi label="Transportadora" value={String(tdc)} hint="TDC" />
        <Kpi label="Proveedor externo" value={String(fwd)} hint="FWD" />
      </div>

      <div className="mt-6 mb-4 flex flex-wrap gap-2">
        {(["todos", "TDC", "FWD"] as const).map((op) => (
          <button
            key={op}
            onClick={() => setFiltro(op)}
            className={`rounded-md px-3 py-1.5 text-sm ring-1 ring-inset transition-colors ${
              filtro === op
                ? "bg-ink text-white ring-transparent"
                : "bg-white ring-[#DEE3DD] hover:bg-black/[0.03]"
            }`}
          >
            {op === "todos" ? "Todos" : op}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber"
        >
          <option value="">Todos los clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <select
          value={filtroLT}
          onChange={(e) => setFiltroLT(e.target.value)}
          className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber"
        >
          <option value="">Todas las líneas de transporte</option>
          <option value="propia">ADL (propia)</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>

        <input
          value={filtroUnidad}
          onChange={(e) => setFiltroUnidad(e.target.value)}
          placeholder="Buscar por unidad…"
          className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber"
        />
      </div>

      {enRuta.length === 0 ? (
        <Card>
          <Empty>No hay servicios activos con este filtro.</Empty>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[2400px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-left text-[11px] uppercase tracking-wide text-muted">
                {ENCABEZADOS.map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {enRuta.map((v) => (
                <FilaMonitoreo key={v.id} viaje={v} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

const ENCABEZADOS = [
  "Carta porte",
  "Cliente",
  "Origen",
  "Destino",
  "Tipo de negocio",
  "Línea de transporte",
  "Unidad",
  "Placas",
  "Contenedor",
  "Operador",
  "Referencia",
  "Medio",
  "Cuenta espejo",
  "Ubicación",
  "Estatus",
  "Observaciones",
  "Cita de carga",
  "Cita de descarga",
  "Salida de patio",
  "Arribo a carga",
  "Ingreso a cargar",
  "Inicio de ruta",
  "Arribo a destino",
  "Ingreso a descarga",
  "Servicio finalizado",
];

const celda = "border-b border-line px-3 py-2 align-top";
const campoTexto =
  "w-32 rounded border border-line bg-white px-1.5 py-1 text-xs outline-none focus:border-amber";
const campoFecha =
  "w-40 rounded border border-line bg-white px-1.5 py-1 text-xs outline-none focus:border-amber";

function FilaMonitoreo({ viaje: v }: { viaje: Viaje }) {
  const { unidad, operador, proveedor, nombreDe, cambiarEstado, actualizarMonitoreo } =
    useStore();
  const esTDC = v.asignacion === "TDC";

  const [ubicacion, setUbicacion] = useState(v.monitoreo.ubicacion);
  const [observaciones, setObservaciones] = useState(v.monitoreo.observaciones);
  const [referencia, setReferencia] = useState(v.monitoreo.referencia);
  const [operadorManual, setOperadorManual] = useState(v.monitoreo.operadorManual);
  const [medioComunicacion, setMedioComunicacion] = useState(v.monitoreo.medioComunicacion);
  const [unidadManual, setUnidadManual] = useState(v.monitoreo.unidadManual);
  const [placaManual, setPlacaManual] = useState(v.monitoreo.placaManual);
  const [cuentaEspejo, setCuentaEspejo] = useState(v.monitoreo.cuentaEspejo);
  const [hitos, setHitos] = useState(() =>
    Object.fromEntries(HITOS_MONITOREO.map((h) => [h.clave, v.monitoreo[h.clave] as string])),
  );
  const [guardando, setGuardando] = useState(false);
  const [modalIncidencia, setModalIncidencia] = useState(false);

  const sucio =
    ubicacion !== v.monitoreo.ubicacion ||
    observaciones !== v.monitoreo.observaciones ||
    referencia !== v.monitoreo.referencia ||
    (!esTDC &&
      (operadorManual !== v.monitoreo.operadorManual ||
        medioComunicacion !== v.monitoreo.medioComunicacion ||
        unidadManual !== v.monitoreo.unidadManual ||
        placaManual !== v.monitoreo.placaManual ||
        cuentaEspejo !== v.monitoreo.cuentaEspejo)) ||
    HITOS_MONITOREO.some((h) => hitos[h.clave] !== v.monitoreo[h.clave]);

  async function guardar() {
    setGuardando(true);
    try {
      await actualizarMonitoreo(v.id, {
        ubicacion,
        observaciones,
        referencia,
        ...(esTDC
          ? {}
          : { operadorManual, medioComunicacion, unidadManual, placaManual, cuentaEspejo }),
        ...hitos,
      });
    } finally {
      setGuardando(false);
    }
  }

  const lineaTransporte = esTDC ? "ADL (propia)" : nombreDe("proveedores", v.proveedorId);
  const contenedor = [v.contenedor1, v.contenedor2].filter(Boolean).join(" / ") || "—";
  const u = esTDC ? unidad(v.unidadId) : undefined;
  const o = esTDC ? operador(v.operadorId) : undefined;

  return (
    <>
    <tr className="hover:bg-black/[0.015]">
      <td className={celda}>
        <Link href={`/viajes/${v.id}`} className="font-medium text-amber hover:underline">
          {v.cartaPorte}
        </Link>
        <p className="text-muted">{v.folio}</p>
      </td>
      <td className={celda}>{v.cliente}</td>
      <td className={celda}>{v.origen}</td>
      <td className={celda}>{v.destino}</td>
      <td className={celda}>{nombreDe("tiposNegocio", v.tipoNegocioId)}</td>
      <td className={celda}>{lineaTransporte}</td>

      <td className={celda}>
        {esTDC ? (
          u?.economico ?? "—"
        ) : (
          <input
            className={campoTexto}
            value={unidadManual}
            onChange={(e) => setUnidadManual(e.target.value)}
            placeholder="Unidad"
          />
        )}
      </td>
      <td className={celda}>
        {esTDC ? (
          u?.placas ?? "—"
        ) : (
          <input
            className={campoTexto}
            value={placaManual}
            onChange={(e) => setPlacaManual(e.target.value)}
            placeholder="Placas"
          />
        )}
      </td>
      <td className={celda}>{contenedor}</td>
      <td className={celda}>
        <div className="flex items-center gap-1.5">
          {esTDC ? (
            <span>{o?.nombre ?? "—"}</span>
          ) : (
            <input
              className={campoTexto}
              value={operadorManual}
              onChange={(e) => setOperadorManual(e.target.value)}
              placeholder="Operador"
            />
          )}
          <button
            type="button"
            onClick={() => setModalIncidencia(true)}
            title="Reportar incidencia a este operador"
            className="shrink-0 rounded p-0.5 text-rose-600 hover:bg-rose-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </td>

      <td className={celda}>
        <input
          className={campoTexto}
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
          placeholder="Referencia"
        />
      </td>
      <td className={celda}>
        {esTDC ? (
          "—"
        ) : (
          <input
            className={campoTexto}
            value={medioComunicacion}
            onChange={(e) => setMedioComunicacion(e.target.value)}
            placeholder="Medio"
          />
        )}
      </td>
      <td className={celda}>
        {esTDC ? (
          "—"
        ) : (
          <input
            className={campoTexto}
            value={cuentaEspejo}
            onChange={(e) => setCuentaEspejo(e.target.value)}
            placeholder="Cuenta espejo"
          />
        )}
      </td>

      <td className={celda}>
        <input
          className={campoTexto}
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
          placeholder="Ubicación"
        />
      </td>
      <td className={celda}>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${SEMAFORO_CLASS[ESTADO_SEMAFORO[v.estado]]}`}
            title={ESTADO_SEMAFORO[v.estado]}
          />
          <select
            value={v.estado}
            onChange={(e) => cambiarEstado(v.id, e.target.value as EstadoViaje)}
            className="rounded border border-line bg-white px-1.5 py-1 text-xs outline-none focus:border-amber"
          >
            {ESTADOS_VIAJE.filter((e) => e.value !== "por_asignar").map((e) => (
              <option key={e.value} value={e.value}>
                {ESTADO_LABEL[e.value]}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className={celda}>
        <input
          className={campoTexto}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Observaciones"
        />
      </td>

      <td className={`${celda} whitespace-nowrap`}>{fechaHora(v.citaCarga)}</td>
      <td className={`${celda} whitespace-nowrap`}>{fechaHora(v.citaDescarga)}</td>

      {HITOS_MONITOREO.map((h) => (
        <td key={h.clave} className={celda}>
          <input
            type="datetime-local"
            className={campoFecha}
            value={hitos[h.clave]}
            onChange={(e) => setHitos((prev) => ({ ...prev, [h.clave]: e.target.value }))}
          />
        </td>
      ))}

      <td className={celda}>
        <button
          type="button"
          onClick={guardar}
          disabled={!sucio || guardando}
          className="whitespace-nowrap rounded-md bg-amber px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </td>
    </tr>

    {modalIncidencia ? (
      <ModalIncidencia
        conductorId={esTDC ? (o?.id ?? null) : null}
        operadorNombre={esTDC ? (o?.nombre ?? "") : operadorManual}
        servicioId={v.id}
        onCerrar={() => setModalIncidencia(false)}
      />
    ) : null}
    </>
  );
}

function ModalIncidencia({
  conductorId,
  operadorNombre,
  servicioId,
  onCerrar,
}: {
  conductorId: string | null;
  operadorNombre: string;
  servicioId: string;
  onCerrar: () => void;
}) {
  const { tiposIncidencia, crearIncidencia } = useStore();
  const [tipoId, setTipoId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [creada, setCreada] = useState(false);

  async function guardar() {
    if (!tipoId) {
      setError("Selecciona el tipo de incidencia.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const datos: NuevaIncidencia = {
        tipoId,
        servicioId,
        descripcion: descripcion.trim() || undefined,
        ...(conductorId ? { conductorId } : { operadorNombre: operadorNombre || "Sin nombre" }),
      };
      await crearIncidencia(datos);
      setCreada(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la incidencia");
    } finally {
      setGuardando(false);
    }
  }

  const campo =
    "w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber";
  const etiqueta = "mb-1 block text-xs font-medium uppercase tracking-wide text-muted";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
        <h2 className="text-sm font-semibold">Reportar incidencia</h2>
        <p className="mt-1 text-xs text-muted">
          Operador: {operadorNombre || "Sin nombre capturado"}
        </p>

        {creada ? (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
            Incidencia registrada. Puedes verla en Seguridad › Incidencias.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label className={etiqueta}>Tipo de incidencia *</label>
              <select
                className={campo}
                value={tipoId}
                onChange={(e) => setTipoId(e.target.value)}
              >
                <option value="">Seleccionar</option>
                {tiposIncidencia
                  .filter((t) => t.activo)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className={etiqueta}>Descripción</label>
              <textarea
                rows={3}
                className={campo}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Detalle de lo ocurrido…"
              />
            </div>
          </div>
        )}

        {error ? (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-black/[0.03]"
          >
            {creada ? "Cerrar" : "Cancelar"}
          </button>
          {!creada ? (
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="rounded-md bg-amber px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Reportar"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

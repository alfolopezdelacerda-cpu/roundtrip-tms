"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Card, Empty, Kpi, PageTitle } from "@/components/ui";
import { fechaHora } from "@/lib/format";
import {
  ESTADO_LABEL,
  ESTADOS_VIAJE,
  HITOS_MONITOREO,
  VIAJE_ACTIVO,
  type Asignacion,
  type EstadoViaje,
  type Viaje,
} from "@/lib/types";

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
  const { viajes } = useStore();
  const [filtro, setFiltro] = useState<Asignacion | "todos">("todos");

  const activos = viajes.filter((v) => VIAJE_ACTIVO.includes(v.estado));
  const enRuta = activos
    .filter((v) => (filtro === "todos" ? true : v.asignacion === filtro))
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
        {esTDC ? (
          o?.nombre ?? "—"
        ) : (
          <input
            className={campoTexto}
            value={operadorManual}
            onChange={(e) => setOperadorManual(e.target.value)}
            placeholder="Operador"
          />
        )}
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
  );
}

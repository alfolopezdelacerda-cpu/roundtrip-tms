"use client";

import { Fragment, useState } from "react";
import { useStore } from "@/lib/store";
import { VIAJE_ACTIVO } from "@/lib/types";
import { Card, PageTitle } from "@/components/ui";

const claseEstado: Record<string, string> = {
  // Vocabulario del backend
  activo: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  inactivo: "bg-slate-100 text-slate-700 ring-slate-200",
  suspendido: "bg-amber-50 text-amber-800 ring-amber-200",
  baja: "bg-rose-50 text-rose-700 ring-rose-200",
  // Vocabulario del modo demostración
  disponible: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  en_viaje: "bg-blue-50 text-blue-700 ring-blue-200",
  descanso: "bg-slate-100 text-slate-700 ring-slate-200",
};

/** Un estado desconocido no debe quedar sin estilo. */
const CLASE_NEUTRA = "bg-slate-100 text-slate-700 ring-slate-200";

const campo =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-amber";

/**
 * RRHH: expediente de operadores. A diferencia del resto de catálogos, este
 * vive en el menú normal (no en el administrador oculto) porque es
 * información que RRHH captura y consulta todos los días.
 */
export default function Operadores() {
  const { operadores, viajes, agregarCatalogo } = useStore();
  const [expandido, setExpandido] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);

  return (
    <>
      <PageTitle
        title="Operadores"
        subtitle={`${operadores.length} operadores registrados`}
        action={
          <button
            onClick={() => setNuevo((v) => !v)}
            className="rounded-md bg-amber px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {nuevo ? "Cancelar" : "+ Nuevo operador"}
          </button>
        }
      />

      {nuevo ? (
        <Card className="mb-4 p-4">
          <FormularioOperador
            onGuardar={async (datos) => {
              await agregarCatalogo("operadores", datos);
              setNuevo(false);
            }}
          />
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Operador</th>
                <th className="px-4 py-2.5 font-medium">Licencia</th>
                <th className="px-4 py-2.5 font-medium">Celular</th>
                <th className="px-4 py-2.5 font-medium">Viaje actual</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  Viajes completados
                </th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DEE3DD]">
              {operadores.map((o) => {
                const actual = viajes.find(
                  (v) =>
                    v.operadorId === o.id && VIAJE_ACTIVO.includes(v.estado),
                );
                const completados = viajes.filter(
                  (v) => v.operadorId === o.id && v.estado === "completado",
                ).length;
                const abierto = expandido === o.id;
                return (
                  <Fragment key={o.id}>
                    <tr className="hover:bg-black/[0.02]">
                      <td className="px-4 py-3 font-medium">{o.nombre}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">
                        {o.licencia}
                      </td>
                      <td className="px-4 py-3 text-muted">{o.celular}</td>
                      <td className="px-4 py-3 text-muted">
                        {actual
                          ? `${actual.folio} · ${actual.origen} → ${actual.destino}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {completados}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${claseEstado[o.estado] ?? CLASE_NEUTRA}`}
                        >
                          {o.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setExpandido(abierto ? null : o.id)}
                          className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-black/[0.03]"
                        >
                          {abierto ? "Cerrar" : "Expediente"}
                        </button>
                      </td>
                    </tr>
                    {abierto ? (
                      <tr>
                        <td colSpan={7} className="bg-black/[0.015] px-4 py-4">
                          <ExpedienteOperador operadorId={o.id} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function ExpedienteOperador({ operadorId }: { operadorId: string }) {
  const { operadores, actualizarCatalogo } = useStore();
  const o = operadores.find((x) => x.id === operadorId);
  if (!o) return null;

  return (
    <FormularioOperador
      valores={o}
      onGuardar={async (datos) => {
        await actualizarCatalogo("operadores", operadorId, datos);
      }}
    />
  );
}

function FormularioOperador({
  valores,
  onGuardar,
}: {
  valores?: {
    nombre: string;
    licencia: string;
    celular: string;
    rfc: string;
    contactoEmergencia: string;
    nss: string;
    estado: string;
  };
  onGuardar: (datos: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    nombre: valores?.nombre ?? "",
    licencia: valores?.licencia ?? "",
    celular: valores?.celular ?? "",
    rfc: valores?.rfc ?? "",
    contactoEmergencia: valores?.contactoEmergencia ?? "",
    nss: valores?.nss ?? "",
    estado: valores?.estado ?? "activo",
  });
  const [guardando, setGuardando] = useState(false);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar(form);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Campo label="Nombre completo">
        <input className={campo} value={form.nombre} onChange={(e) => set("nombre")(e.target.value)} />
      </Campo>
      <Campo label="Licencia">
        <input className={campo} value={form.licencia} onChange={(e) => set("licencia")(e.target.value)} />
      </Campo>
      <Campo label="Celular">
        <input className={campo} value={form.celular} onChange={(e) => set("celular")(e.target.value)} placeholder="55 1234 5678" />
      </Campo>
      <Campo label="RFC">
        <input className={campo} value={form.rfc} onChange={(e) => set("rfc")(e.target.value)} placeholder="ROBJ850312H12" />
      </Campo>
      <Campo label="Número de seguridad social (IMSS)">
        <input className={campo} value={form.nss} onChange={(e) => set("nss")(e.target.value)} placeholder="12345678901" />
      </Campo>
      <Campo label="Contacto de emergencia">
        <input
          className={campo}
          value={form.contactoEmergencia}
          onChange={(e) => set("contactoEmergencia")(e.target.value)}
          placeholder="Nombre · teléfono"
        />
      </Campo>
      <Campo label="Estado">
        <select className={campo} value={form.estado} onChange={(e) => set("estado")(e.target.value)}>
          {["activo", "inactivo", "suspendido", "baja"].map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
      </Campo>
      <div className="sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-amber px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar"}
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

"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, Empty, PageTitle } from "@/components/ui";
import { mxn } from "@/lib/format";

const campo =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-amber";

/**
 * Catálogo de rutas frecuentes: código, tramo y proyecciones de km y
 * casetas. Asignación TDC lee de aquí para autocompletar esos dos campos
 * al elegir un "Código de Ruta".
 */
export default function Rutas() {
  const { rutas, agregarCatalogo, actualizarCatalogo, usosDeCatalogo } = useStore();
  const [nuevo, setNuevo] = useState(false);

  return (
    <>
      <PageTitle
        title="Rutas"
        subtitle={`${rutas.length} rutas registradas · alimenta el código de ruta de Asignación TDC`}
        action={
          <button
            onClick={() => setNuevo((v) => !v)}
            className="rounded-md bg-amber px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {nuevo ? "Cancelar" : "+ Nueva ruta"}
          </button>
        }
      />

      {nuevo ? (
        <Card className="mb-4 p-4">
          <FormularioRuta
            onGuardar={async (datos) => {
              if (await agregarCatalogo("rutas", datos)) setNuevo(false);
            }}
          />
        </Card>
      ) : null}

      {rutas.length === 0 ? (
        <Card>
          <Empty>No hay rutas registradas.</Empty>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rutas.map((r) => (
            <Card key={r.id} className={`p-4 ${r.activo ? "" : "opacity-50"}`}>
              <div className="mb-2 flex items-start justify-between">
                <p className="font-mono text-sm font-semibold">{r.codigo}</p>
                <span className="text-xs text-muted">
                  {usosDeCatalogo("rutas", r.id)} servicio(s)
                </span>
              </div>
              <p className="text-sm text-muted">
                {r.origen} → {r.destino}
              </p>
              <div className="mt-3 flex gap-4 text-sm">
                <span>
                  <span className="text-muted">Km:</span> {r.kmProyectados}
                </span>
                <span>
                  <span className="text-muted">Casetas:</span> {mxn(r.casetasProyectadas)}
                </span>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={r.activo}
                  onChange={(e) =>
                    actualizarCatalogo("rutas", r.id, { activo: e.target.checked })
                  }
                  className="h-4 w-4 accent-[#C97A0F]"
                />
                Activa
              </label>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function FormularioRuta({
  onGuardar,
}: {
  onGuardar: (datos: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    codigo: "",
    origen: "",
    destino: "",
    kmProyectados: "",
    casetasProyectadas: "",
  });
  const [guardando, setGuardando] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar({
        codigo: form.codigo.trim(),
        origen: form.origen.trim(),
        destino: form.destino.trim(),
        kmProyectados: Number(form.kmProyectados) || 0,
        casetasProyectadas: Number(form.casetasProyectadas) || 0,
      });
      setForm({ codigo: "", origen: "", destino: "", kmProyectados: "", casetasProyectadas: "" });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
          Código
        </label>
        <input className={campo} value={form.codigo} onChange={(e) => set("codigo")(e.target.value)} placeholder="CDMX-MTY" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
          Origen
        </label>
        <input className={campo} value={form.origen} onChange={(e) => set("origen")(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
          Destino
        </label>
        <input className={campo} value={form.destino} onChange={(e) => set("destino")(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
          Km proyectados
        </label>
        <input type="number" min={0} className={campo} value={form.kmProyectados} onChange={(e) => set("kmProyectados")(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
          Casetas proyectadas
        </label>
        <input type="number" min={0} className={campo} value={form.casetasProyectadas} onChange={(e) => set("casetasProyectadas")(e.target.value)} />
      </div>
      <div className="sm:col-span-2 lg:col-span-5">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-amber px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar ruta"}
        </button>
      </div>
    </form>
  );
}

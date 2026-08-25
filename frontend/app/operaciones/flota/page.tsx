"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, Empty, PageTitle } from "@/components/ui";
import { alertaVigencia, SEMAFORO_CLASS } from "@/lib/types";
import { fecha } from "@/lib/format";

const campo =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-amber";

/** Tamaño máximo por archivo: es base64 en la fila, no un bucket de objetos. */
const MAX_BYTES_ARCHIVO = 2 * 1024 * 1024;

/**
 * Flota: alta y expediente digital de la unidad — placas, modelo, año, NIV,
 * color, fotografías, documentos, y las vigencias de seguro y verificación.
 * Las alertas de vencimiento son la señal que Mantenimiento va a consumir
 * cuando ese módulo exista; por ahora solo se muestran aquí.
 */
export default function Flota() {
  const { unidades } = useStore();
  const [nuevo, setNuevo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  const vencidas = unidades.filter(
    (u) => alertaVigencia(u.vencimientoSeguro) === "rojo" || alertaVigencia(u.verificacionVencimiento) === "rojo",
  ).length;

  return (
    <>
      <PageTitle
        title="Flota"
        subtitle={`${unidades.length} unidades · ${vencidas} con vigencias vencidas`}
        action={
          <button
            onClick={() => setNuevo((v) => !v)}
            className="rounded-md bg-amber px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {nuevo ? "Cancelar" : "+ Nueva unidad"}
          </button>
        }
      />

      {nuevo ? (
        <Card className="mb-4 p-4">
          <FormularioUnidad onCerrar={() => setNuevo(false)} />
        </Card>
      ) : null}

      {unidades.length === 0 ? (
        <Card>
          <Empty>No hay unidades registradas.</Empty>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {unidades.map((u) => {
            const abierta = editando === u.id;
            const alertaSeguro = alertaVigencia(u.vencimientoSeguro);
            const alertaVerificacion = alertaVigencia(u.verificacionVencimiento);
            return (
              <Card key={u.id} className={`p-4 ${u.activo ? "" : "opacity-50"}`}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{u.economico}</p>
                    <p className="text-sm text-muted">
                      {u.marca || u.modelo ? `${u.marca} ${u.modelo}`.trim() : u.tipo}
                      {u.anio ? ` · ${u.anio}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditando(abierta ? null : u.id)}
                    className="shrink-0 rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-black/[0.03]"
                  >
                    {abierta ? "Cerrar" : "Editar"}
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <Dato k="Placas" v={u.placas} />
                  <Dato k="Color" v={u.color || "—"} />
                  <Dato k="NIV" v={u.vin || "—"} />
                  <Dato k="Capacidad" v={u.capacidadTon ? `${u.capacidadTon} ton` : "—"} />
                </dl>

                <div className="mt-3 flex flex-wrap gap-2">
                  <PastillaVigencia titulo="Seguro" fecha={u.vencimientoSeguro} alerta={alertaSeguro} />
                  <PastillaVigencia
                    titulo="Verificación"
                    fecha={u.verificacionVencimiento}
                    alerta={alertaVerificacion}
                  />
                </div>

                {u.fotos.length > 0 ? (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {u.fotos.map((f, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={f}
                        alt={`${u.economico} foto ${i + 1}`}
                        className="h-16 w-16 shrink-0 rounded-md object-cover ring-1 ring-line"
                      />
                    ))}
                  </div>
                ) : null}

                {u.documentos.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-xs">
                    {u.documentos.map((d, i) => (
                      <li key={i}>
                        <a
                          href={d.datos}
                          download={d.nombre}
                          className="text-amber hover:underline"
                        >
                          {d.nombre}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {abierta ? (
                  <div className="mt-4 border-t border-line pt-4">
                    <FormularioUnidad unidadId={u.id} onCerrar={() => setEditando(null)} />
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

function PastillaVigencia({
  titulo,
  fecha: valor,
  alerta,
}: {
  titulo: string;
  fecha: string | null;
  alerta: "verde" | "amarillo" | "rojo" | null;
}) {
  const clase = alerta ? SEMAFORO_CLASS[alerta] : "bg-slate-300";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.03] px-2 py-1 text-xs">
      <span className={`h-2 w-2 rounded-full ${clase}`} />
      {titulo}: {valor ? fecha(valor) : "sin registrar"}
    </span>
  );
}

/** Convierte un archivo elegido a data URL (base64) para guardarlo en la fila. */
function archivoADataUrl(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(archivo);
  });
}

function FormularioUnidad({
  unidadId,
  onCerrar,
}: {
  unidadId?: string;
  onCerrar: () => void;
}) {
  const { unidades, agregarCatalogo, actualizarCatalogo } = useStore();
  const existente = unidadId ? unidades.find((u) => u.id === unidadId) : undefined;

  const [form, setForm] = useState({
    economico: existente?.economico ?? "",
    placas: existente?.placas ?? "",
    tipo: existente?.tipo ?? "sencillo",
    capacidadTon: existente ? String(existente.capacidadTon) : "",
    marca: existente?.marca ?? "",
    modelo: existente?.modelo ?? "",
    anio: existente?.anio ? String(existente.anio) : "",
    vin: existente?.vin ?? "",
    color: existente?.color ?? "",
    polizaSeguro: existente?.polizaSeguro ?? "",
    vencimientoSeguro: existente?.vencimientoSeguro ?? "",
    verificacionVigente: existente?.verificacionVigente ?? false,
    verificacionVencimiento: existente?.verificacionVencimiento ?? "",
  });
  const [fotos, setFotos] = useState<string[]>(existente?.fotos ?? []);
  const [documentos, setDocumentos] = useState(existente?.documentos ?? []);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const set = (k: keyof typeof form) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }) as typeof form);

  async function agregarFotos(lista: FileList | null) {
    if (!lista) return;
    const nuevas: string[] = [];
    for (const archivo of Array.from(lista)) {
      if (archivo.size > MAX_BYTES_ARCHIVO) {
        setAviso(`"${archivo.name}" pesa más de 2 MB; en modo de prueba no se admite.`);
        continue;
      }
      nuevas.push(await archivoADataUrl(archivo));
    }
    setFotos((prev) => [...prev, ...nuevas]);
  }

  async function agregarDocumentos(lista: FileList | null) {
    if (!lista) return;
    const nuevos: { nombre: string; datos: string }[] = [];
    for (const archivo of Array.from(lista)) {
      if (archivo.size > MAX_BYTES_ARCHIVO) {
        setAviso(`"${archivo.name}" pesa más de 2 MB; en modo de prueba no se admite.`);
        continue;
      }
      nuevos.push({ nombre: archivo.name, datos: await archivoADataUrl(archivo) });
    }
    setDocumentos((prev) => [...prev, ...nuevos]);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.economico.trim() || !form.placas.trim()) {
      setAviso("Económico y placas son obligatorios.");
      return;
    }

    // Los campos de texto y el año son opcionales, pero si van vacíos no se
    // mandan: el DTO exige longitud/rango mínimo cuando sí vienen.
    const datos = {
      economico: form.economico.trim(),
      placas: form.placas.trim(),
      tipo: form.tipo,
      capacidadTon: Number(form.capacidadTon) || 0,
      ...(form.marca.trim() ? { marca: form.marca.trim() } : {}),
      ...(form.modelo.trim() ? { modelo: form.modelo.trim() } : {}),
      ...(Number(form.anio) ? { anio: Number(form.anio) } : {}),
      ...(form.vin.trim() ? { vin: form.vin.trim() } : {}),
      ...(form.color.trim() ? { color: form.color.trim() } : {}),
      ...(form.polizaSeguro.trim() ? { polizaSeguro: form.polizaSeguro.trim() } : {}),
      ...(form.vencimientoSeguro ? { vencimientoSeguro: form.vencimientoSeguro } : {}),
      verificacionVigente: form.verificacionVigente,
      ...(form.verificacionVencimiento
        ? { verificacionVencimiento: form.verificacionVencimiento }
        : {}),
      fotos,
      documentos,
    };

    setGuardando(true);
    setAviso(null);
    try {
      if (existente) {
        await actualizarCatalogo("unidades", existente.id, datos);
      } else {
        await agregarCatalogo("unidades", datos);
      }
      onCerrar();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo label="Económico *">
          <input className={campo} value={form.economico} onChange={(e) => set("economico")(e.target.value)} />
        </Campo>
        <Campo label="Placas *">
          <input className={campo} value={form.placas} onChange={(e) => set("placas")(e.target.value)} />
        </Campo>
        <Campo label="Tipo">
          <select className={campo} value={form.tipo} onChange={(e) => set("tipo")(e.target.value)}>
            {["full_trailer", "sencillo", "rabon", "pickup"].map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Capacidad (ton)">
          <input type="number" min={0} className={campo} value={form.capacidadTon} onChange={(e) => set("capacidadTon")(e.target.value)} />
        </Campo>

        <Campo label="Marca">
          <input className={campo} value={form.marca} onChange={(e) => set("marca")(e.target.value)} />
        </Campo>
        <Campo label="Modelo">
          <input className={campo} value={form.modelo} onChange={(e) => set("modelo")(e.target.value)} />
        </Campo>
        <Campo label="Año">
          <input type="number" min={1950} max={2100} className={campo} value={form.anio} onChange={(e) => set("anio")(e.target.value)} />
        </Campo>
        <Campo label="Color">
          <input className={campo} value={form.color} onChange={(e) => set("color")(e.target.value)} />
        </Campo>

        <Campo label="NIV / VIN">
          <input className={campo} value={form.vin} onChange={(e) => set("vin")(e.target.value)} />
        </Campo>
        <Campo label="Póliza de seguro">
          <input className={campo} value={form.polizaSeguro} onChange={(e) => set("polizaSeguro")(e.target.value)} />
        </Campo>
        <Campo label="Vigencia del seguro">
          <input type="date" className={campo} value={form.vencimientoSeguro} onChange={(e) => set("vencimientoSeguro")(e.target.value)} />
        </Campo>
        <Campo label="Vigencia de verificación">
          <input type="date" className={campo} value={form.verificacionVencimiento} onChange={(e) => set("verificacionVencimiento")(e.target.value)} />
        </Campo>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.verificacionVigente}
          onChange={(e) => set("verificacionVigente")(e.target.checked)}
          className="h-4 w-4 accent-[#C97A0F]"
        />
        Verificación vigente
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Fotografías de la unidad">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => void agregarFotos(e.target.files)}
            className="text-sm"
          />
          {fotos.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {fotos.map((f, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f} alt="" className="h-14 w-14 rounded-md object-cover ring-1 ring-line" />
                  <button
                    type="button"
                    onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1.5 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </Campo>

        <Campo label="Expediente digital (documentos)">
          <input type="file" multiple onChange={(e) => void agregarDocumentos(e.target.files)} className="text-sm" />
          {documentos.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs">
              {documentos.map((d, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="truncate">{d.nombre}</span>
                  <button
                    type="button"
                    onClick={() => setDocumentos((prev) => prev.filter((_, j) => j !== i))}
                    className="text-rose-600 hover:underline"
                  >
                    quitar
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Campo>
      </div>

      {aviso ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          {aviso}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={guardando}
        className="rounded-md bg-amber px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {guardando ? "Guardando…" : "Guardar unidad"}
      </button>
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

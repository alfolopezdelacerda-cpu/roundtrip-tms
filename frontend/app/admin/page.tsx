"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { ClaveCatalogo } from "@/lib/catalogos";
import { Card, Empty, PageTitle } from "@/components/ui";

type TipoCampo = "texto" | "numero" | "select" | "check";

type CampoCatalogo = {
  clave: string;
  titulo: string;
  tipo: TipoCampo;
  opciones?: string[];
  ancho?: string;
  /** Valor con el que nace el campo al dar de alta un registro. */
  inicial?: string | number | boolean;
};

type DefinicionCatalogo = {
  clave: ClaveCatalogo;
  titulo: string;
  descripcion: string;
  campos: CampoCatalogo[];
};

/**
 * Definición declarativa de cada catálogo: la tabla, el alta y la edición se
 * generan a partir de aquí, así que agregar un catálogo nuevo es agregar una
 * entrada a esta lista.
 */
const CATALOGOS: DefinicionCatalogo[] = [
  {
    clave: "clientes",
    titulo: "Clientes",
    descripcion: "Alimenta el alta de viaje y define los días de crédito de CXC.",
    campos: [
      { clave: "nombre", titulo: "Nombre", tipo: "texto" },
      { clave: "rfc", titulo: "RFC", tipo: "texto", ancho: "w-40" },
      // Obligatorios para emitir CFDI 4.0 al cliente.
      { clave: "regimenFiscal", titulo: "Régimen", tipo: "texto", ancho: "w-24" },
      { clave: "codigoPostal", titulo: "CP", tipo: "texto", ancho: "w-24" },
      { clave: "diasCredito", titulo: "Días crédito", tipo: "numero", inicial: 30 },
    ],
  },
  {
    clave: "proveedores",
    titulo: "Proveedores",
    descripcion: "Quienes ejecutan los servicios FWD y generan cuentas por pagar.",
    campos: [
      { clave: "nombre", titulo: "Nombre", tipo: "texto" },
      {
        clave: "tipo",
        titulo: "Tipo",
        tipo: "select",
        opciones: ["transportista", "agente_aduanal", "almacen"],
        inicial: "transportista",
      },
      { clave: "diasPago", titulo: "Días pago", tipo: "numero", inicial: 30 },
      { clave: "contacto", titulo: "Contacto", tipo: "texto" },
    ],
  },
  {
    clave: "unidades",
    titulo: "Unidades",
    descripcion: "Flota propia disponible para los servicios TDC.",
    campos: [
      { clave: "economico", titulo: "Económico", tipo: "texto", ancho: "w-32" },
      { clave: "placas", titulo: "Placas", tipo: "texto", ancho: "w-36" },
      {
        clave: "tipo",
        titulo: "Tipo",
        tipo: "select",
        opciones: ["full_trailer", "sencillo", "rabon", "pickup"],
        inicial: "full_trailer",
      },
      { clave: "capacidadTon", titulo: "Ton", tipo: "numero", inicial: 30 },
      {
        clave: "estado",
        titulo: "Estado",
        tipo: "select",
        opciones: ["operativo", "mantenimiento", "fuera_servicio", "vendido"],
        inicial: "operativo",
      },
      // Datos que exige el complemento Carta Porte para emitir.
      { clave: "configVehicular", titulo: "Config. SAT", tipo: "texto", ancho: "w-28" },
      { clave: "permisoSct", titulo: "Permiso SCT", tipo: "texto", ancho: "w-28" },
      { clave: "numPermisoSct", titulo: "Núm. permiso", tipo: "texto", ancho: "w-36" },
      { clave: "anio", titulo: "Modelo", tipo: "numero", inicial: 2020 },
      { clave: "aseguradoraCivil", titulo: "Aseguradora", tipo: "texto", ancho: "w-36" },
      { clave: "polizaCivil", titulo: "Póliza", tipo: "texto", ancho: "w-32" },
    ],
  },
  {
    clave: "operadores",
    titulo: "Operadores",
    descripcion: "Personal de conducción de la transportadora.",
    campos: [
      { clave: "nombre", titulo: "Nombre", tipo: "texto" },
      { clave: "licencia", titulo: "Licencia", tipo: "texto", ancho: "w-36" },
      { clave: "telefono", titulo: "Teléfono", tipo: "texto", ancho: "w-36" },
      { clave: "rfc", titulo: "RFC", tipo: "texto", ancho: "w-36" },
      {
        clave: "estado",
        titulo: "Estado",
        tipo: "select",
        opciones: ["activo", "inactivo", "suspendido", "baja"],
        inicial: "activo",
      },
    ],
  },
  {
    clave: "puertos",
    titulo: "Puertos",
    descripcion: "Puertos y cruces fronterizos del campo Puerto.",
    campos: [{ clave: "nombre", titulo: "Nombre", tipo: "texto" }],
  },
  {
    clave: "tiposNegocio",
    titulo: "Tipos de negocio",
    descripcion: "Dedicado, expo, impo, local…",
    campos: [{ clave: "nombre", titulo: "Nombre", tipo: "texto" }],
  },
  {
    clave: "tiposUnidad",
    titulo: "Tipos de unidad",
    descripcion: "Marcar «full» habilita el segundo contenedor en el alta.",
    campos: [
      { clave: "nombre", titulo: "Nombre", tipo: "texto" },
      { clave: "full", titulo: "Full", tipo: "check", inicial: false },
    ],
  },
  {
    clave: "tiposMercancia",
    titulo: "Tipos de mercancía",
    descripcion: "Clasificación de la carga.",
    campos: [{ clave: "nombre", titulo: "Nombre", tipo: "texto" }],
  },
];

/**
 * Administrador oculto. No aparece en el menú: se entra dando tres clics
 * seguidos al logo. No es un control de acceso —todo vive en el navegador—
 * sino una forma de mantener los catálogos fuera del uso diario.
 */
export default function Admin() {
  const [activa, setActiva] = useState<ClaveCatalogo>("clientes");
  const definicion = CATALOGOS.find((c) => c.clave === activa)!;

  return (
    <>
      <PageTitle
        title="Administrador"
        subtitle="Catálogos del sistema. Solo accesible desde el logo."
        action={
          <Link
            href="/"
            className="rounded-md border border-line px-3 py-2 text-sm hover:bg-black/[0.03]"
          >
            Salir
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {CATALOGOS.map((c) => (
          <button
            key={c.clave}
            onClick={() => setActiva(c.clave)}
            className={`rounded-md px-3 py-1.5 text-sm ring-1 ring-inset transition-colors ${
              activa === c.clave
                ? "bg-ink text-white ring-transparent"
                : "bg-white ring-[#DEE3DD] hover:bg-black/[0.03]"
            }`}
          >
            {c.titulo}
          </button>
        ))}
      </div>

      <TablaCatalogo key={definicion.clave} definicion={definicion} />
    </>
  );
}

function TablaCatalogo({ definicion }: { definicion: DefinicionCatalogo }) {
  const store = useStore();
  const { agregarCatalogo, actualizarCatalogo, eliminarCatalogo, usosDeCatalogo } = store;

  const registros = store[definicion.clave] as unknown as Array<
    { id: string; activo: boolean } & Record<string, unknown>
  >;

  const [nuevo, setNuevo] = useState<Record<string, unknown>>(() => inicial(definicion));
  const [aviso, setAviso] = useState<string | null>(null);

  async function alta(e: React.FormEvent) {
    e.preventDefault();
    const principal = definicion.campos[0].clave;
    if (!String(nuevo[principal] ?? "").trim()) {
      setAviso(`${definicion.campos[0].titulo} es obligatorio.`);
      return;
    }
    await agregarCatalogo(definicion.clave, nuevo);
    setNuevo(inicial(definicion));
    setAviso(null);
  }

  async function borrar(id: string) {
    try {
      // Quien decide si se borra o se desactiva es el backend: es el único
      // que sabe con certeza cuántos servicios lo referencian.
      const resultado = await eliminarCatalogo(definicion.clave, id);
      setAviso(
        resultado.desactivado
          ? `Ese registro lo usan ${resultado.usos} servicio(s). Se desactivó en vez de borrarse.`
          : null,
      );
    } catch (error) {
      setAviso(error instanceof Error ? error.message : "No se pudo borrar");
    }
  }

  return (
    <>
      <Card className="mb-4 p-4">
        <p className="mb-3 text-sm text-muted">{definicion.descripcion}</p>
        <form onSubmit={alta} className="flex flex-wrap items-end gap-2">
          {definicion.campos.map((c) => (
            <div key={c.clave}>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                {c.titulo}
              </label>
              <Entrada
                campo={c}
                valor={nuevo[c.clave]}
                onChange={(v) => setNuevo((n) => ({ ...n, [c.clave]: v }))}
              />
            </div>
          ))}
          <button
            type="submit"
            className="rounded-md bg-amber px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Agregar
          </button>
        </form>
        {aviso ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
            {aviso}
          </p>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        {registros.length === 0 ? (
          <Empty>Este catálogo está vacío.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  {definicion.campos.map((c) => (
                    <th key={c.clave} className="px-4 py-2.5 font-medium">
                      {c.titulo}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 font-medium">Usos</th>
                  <th className="px-4 py-2.5 font-medium">Activo</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE3DD]">
                {registros.map((r) => (
                  <tr key={r.id} className={r.activo ? "" : "opacity-50"}>
                    {definicion.campos.map((c) => (
                      <td key={c.clave} className="px-4 py-2">
                        <Entrada
                          campo={c}
                          valor={r[c.clave]}
                          onChange={(v) =>
                            actualizarCatalogo(definicion.clave, r.id, { [c.clave]: v })
                          }
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2 tabular-nums text-muted">
                      {usosDeCatalogo(definicion.clave, r.id)}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={r.activo}
                        onChange={(e) =>
                          actualizarCatalogo(definicion.clave, r.id, {
                            activo: e.target.checked,
                          })
                        }
                        className="h-4 w-4 accent-[#C97A0F]"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => borrar(r.id)}
                        className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-rose-50 hover:text-rose-700"
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-muted">
        Un registro en uso no se borra:
        se desactiva, y deja de ofrecerse en el alta de viaje sin romper los
        servicios que ya lo usan.
      </p>
    </>
  );
}

function Entrada({
  campo,
  valor,
  onChange,
}: {
  campo: CampoCatalogo;
  valor: unknown;
  onChange: (v: string | number | boolean) => void;
}) {
  const base = `rounded-md border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-amber ${
    campo.ancho ?? "w-full min-w-40"
  }`;

  if (campo.tipo === "check") {
    return (
      <input
        type="checkbox"
        checked={Boolean(valor)}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#C97A0F]"
      />
    );
  }

  if (campo.tipo === "select") {
    return (
      <select
        className={base}
        value={String(valor ?? "")}
        onChange={(e) => onChange(e.target.value)}
      >
        {campo.opciones?.map((o) => (
          <option key={o} value={o}>
            {o.replace("_", " ")}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={campo.tipo === "numero" ? "number" : "text"}
      className={base}
      value={String(valor ?? "")}
      onChange={(e) =>
        onChange(campo.tipo === "numero" ? Number(e.target.value) : e.target.value)
      }
    />
  );
}

function inicial(definicion: DefinicionCatalogo): Record<string, unknown> {
  return Object.fromEntries(
    definicion.campos.map((c) => [c.clave, c.inicial ?? (c.tipo === "numero" ? 0 : "")]),
  );
}

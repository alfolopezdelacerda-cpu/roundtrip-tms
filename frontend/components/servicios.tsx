"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { fechaHora, km, mxn } from "@/lib/format";
import {
  ASIGNACION_CLASS,
  ASIGNACION_LABEL,
  COBRO_CLASS,
  COBRO_LABEL,
  ESTADO_CLASS,
  ESTADO_LABEL,
  PAGO_CLASS,
  PAGO_LABEL,
  TEMPERATURA_CLASS,
  TEMPERATURA_LABEL,
  margen,
  rutaTexto,
  type Asignacion,
  type EstadoCobro,
  type EstadoPago,
  type EstadoViaje,
  type Temperatura,
  type Viaje,
} from "@/lib/types";
import { Card, Empty } from "./ui";

export function EstadoBadge({ estado }: { estado: EstadoViaje }) {
  return <Badge className={ESTADO_CLASS[estado]}>{ESTADO_LABEL[estado]}</Badge>;
}

export function CobroBadge({ estado }: { estado: EstadoCobro }) {
  return <Badge className={COBRO_CLASS[estado]}>{COBRO_LABEL[estado]}</Badge>;
}

export function PagoBadge({ estado }: { estado: EstadoPago }) {
  return <Badge className={PAGO_CLASS[estado]}>{PAGO_LABEL[estado]}</Badge>;
}

export function AsignacionBadge({ asignacion }: { asignacion: Asignacion }) {
  return (
    <Badge className={ASIGNACION_CLASS[asignacion]}>
      {asignacion} · {ASIGNACION_LABEL[asignacion]}
    </Badge>
  );
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

/** En round trip la unidad vuelve al origen; en one way, no. */
export function Ruta({ viaje }: { viaje: Viaje }) {
  return (
    <span className="whitespace-nowrap font-medium">
      {rutaTexto(viaje)}{" "}
      <span className="text-xs font-normal text-muted">({viaje.modalidad})</span>
    </span>
  );
}

export function TemperaturaBadge({ temperatura }: { temperatura: Temperatura }) {
  return (
    <Badge className={TEMPERATURA_CLASS[temperatura]}>
      {TEMPERATURA_LABEL[temperatura]}
    </Badge>
  );
}

export function FolioLink({ viaje }: { viaje: Viaje }) {
  return (
    <Link href={`/viajes/${viaje.id}`} className="font-mono text-xs hover:underline">
      {viaje.folio}
    </Link>
  );
}

export function Barra({ valor }: { valor: number }) {
  const pct = Math.max(0, Math.min(100, valor));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-black/10">
        <div className="h-full rounded-full bg-amber" style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-xs text-muted">{pct}%</span>
    </div>
  );
}

export type Columna = {
  clave: string;
  titulo: string;
  alineacion?: "izq" | "der";
  celda: (v: Viaje) => ReactNode;
};

/**
 * Tabla de servicios con buscador. Todas las secciones (TDC, FWD, CXC, CXP,
 * liquidación) muestran el mismo conjunto de servicios filtrado y con
 * columnas distintas, así que la tabla se define una vez.
 */
export function TablaServicios({
  viajes,
  columnas,
  vacio = "No hay servicios en esta vista.",
  totales,
}: {
  viajes: Viaje[];
  columnas: Columna[];
  vacio?: string;
  totales?: ReactNode;
}) {
  const [q, setQ] = useState("");

  const filtrados = useMemo(() => {
    const texto = q.trim().toLowerCase();
    if (!texto) return viajes;
    return viajes.filter((v) =>
      [v.folio, v.cliente, v.origen, v.destino].some((c) =>
        c.toLowerCase().includes(texto),
      ),
    );
  }, [viajes, q]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar folio, cliente o ruta…"
          className="min-w-56 flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber"
        />
        {totales}
      </div>

      <Card className="overflow-hidden">
        {filtrados.length === 0 ? (
          <Empty>{vacio}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  {columnas.map((c) => (
                    <th
                      key={c.clave}
                      className={`px-4 py-2.5 font-medium ${
                        c.alineacion === "der" ? "text-right" : ""
                      }`}
                    >
                      {c.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE3DD]">
                {filtrados.map((v) => (
                  <tr key={v.id} className="hover:bg-black/[0.02]">
                    {columnas.map((c) => (
                      <td
                        key={c.clave}
                        className={`px-4 py-3 ${
                          c.alineacion === "der" ? "text-right tabular-nums" : ""
                        }`}
                      >
                        {c.celda(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/** Columnas que comparten casi todas las vistas. */
export const columnaFolio: Columna = {
  clave: "folio",
  titulo: "Folio",
  celda: (v) => <FolioLink viaje={v} />,
};

export const columnaRuta: Columna = {
  clave: "ruta",
  titulo: "Ruta",
  celda: (v) => <Ruta viaje={v} />,
};

export const columnaCartaPorte: Columna = {
  clave: "cartaPorte",
  titulo: "Carta porte",
  celda: (v) => <span className="font-mono text-xs text-muted">{v.cartaPorte}</span>,
};

export const columnaCliente: Columna = {
  clave: "cliente",
  titulo: "Cliente",
  celda: (v) => <span className="text-muted">{v.cliente}</span>,
};

export const columnaSalida: Columna = {
  clave: "salida",
  titulo: "Salida",
  celda: (v) => <span className="text-muted">{fechaHora(v.citaCarga)}</span>,
};

export const columnaKm: Columna = {
  clave: "km",
  titulo: "Km",
  alineacion: "der",
  celda: (v) => km(v.km),
};

export const columnaTarifa: Columna = {
  clave: "tarifa",
  titulo: "Tarifa",
  alineacion: "der",
  celda: (v) => mxn(v.tarifa),
};

export const columnaMargen: Columna = {
  clave: "margen",
  titulo: "Margen",
  alineacion: "der",
  celda: (v) => {
    const m = margen(v);
    return (
      <span className={m < 0 ? "text-rose-700" : undefined}>{mxn(m)}</span>
    );
  },
};

export const columnaEstado: Columna = {
  clave: "estado",
  titulo: "Estado",
  celda: (v) => <EstadoBadge estado={v.estado} />,
};

/** Fila de totales para las vistas financieras. */
export function Totales({ items }: { items: { label: string; valor: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      {items.map((i) => (
        <span key={i.label} className="text-muted">
          {i.label}:{" "}
          <strong className="font-semibold tabular-nums text-ink">{i.valor}</strong>
        </span>
      ))}
    </div>
  );
}

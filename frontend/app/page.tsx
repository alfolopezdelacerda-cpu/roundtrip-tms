"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import {
  VIAJE_ACTIVO,
  esLiquidable,
  margen,
  operadorDisponible,
  unidadDisponible,
} from "@/lib/types";
import { mxn } from "@/lib/format";
import { Card, Kpi, PageTitle } from "@/components/ui";

/**
 * Tablero: una tarjeta por sección del menú con su cifra pendiente, para
 * entrar directo a donde hay trabajo.
 */
export default function Tablero() {
  const { viajes, unidades, operadores } = useStore();

  const activos = viajes.filter((v) => VIAJE_ACTIVO.includes(v.estado));
  const vivos = viajes.filter((v) => v.estado !== "cancelado");
  const facturable = vivos.reduce((s, v) => s + v.tarifa, 0);
  const margenTotal = vivos.reduce((s, v) => s + margen(v), 0);

  const tdc = activos.filter((v) => v.asignacion === "TDC");
  const fwd = activos.filter((v) => v.asignacion === "FWD");
  const sinAsignar = activos.filter((v) =>
    v.asignacion === "TDC" ? !v.unidadId || !v.operadorId : !v.proveedorId,
  ).length;

  const cxc = viajes.filter(
    (v) => v.estado === "completado" && v.cobro.estado !== "cobrado",
  );
  const cxcVencido = cxc.filter((v) => v.cobro.estado === "vencido");
  const cxp = viajes.filter(
    (v) => v.estado === "completado" && v.pago.estado !== "pagado" && v.costo > 0,
  );
  const porLiquidar = viajes.filter(esLiquidable);

  return (
    <>
      <PageTitle
        title="Tablero"
        subtitle="Resumen operativo y financiero de los servicios."
        action={
          <Link
            href="/viajes/nuevo"
            className="rounded-md bg-amber px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Nuevo viaje
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Servicios activos"
          value={String(activos.length)}
          hint={`${tdc.length} TDC · ${fwd.length} FWD`}
        />
        <Kpi label="Facturación" value={mxn(facturable)} hint="Excluye cancelados" />
        <Kpi
          label="Margen"
          value={mxn(margenTotal)}
          hint={facturable ? `${Math.round((margenTotal / facturable) * 100)}%` : undefined}
        />
        <Kpi
          label="Disponibles"
          value={`${unidades.filter(unidadDisponible).length} / ${
            operadores.filter(operadorDisponible).length
          }`}
          hint="Unidades / operadores"
        />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Atajo
          href="/asignacion-tdc"
          titulo="Asignación TDC"
          cifra={String(tdc.length)}
          detalle={
            sinAsignar
              ? `${sinAsignar} servicio(s) sin unidad u operador`
              : "Todo asignado"
          }
          alerta={sinAsignar > 0}
        />
        <Atajo
          href="/asignacion-fwd"
          titulo="Asignación FWD"
          cifra={String(fwd.length)}
          detalle="Servicios con proveedor externo"
        />
        <Atajo
          href="/monitoreo"
          titulo="Monitoreo"
          cifra={String(activos.filter((v) => v.estado !== "programado").length)}
          detalle="Servicios en camino"
        />
        <Atajo
          href="/cxc"
          titulo="CXC"
          cifra={mxn(cxc.reduce((s, v) => s + v.tarifa, 0))}
          detalle={
            cxcVencido.length
              ? `${cxcVencido.length} factura(s) vencida(s)`
              : `${cxc.length} servicio(s) por cobrar`
          }
          alerta={cxcVencido.length > 0}
        />
        <Atajo
          href="/cxp"
          titulo="CXP"
          cifra={mxn(cxp.reduce((s, v) => s + v.costo, 0))}
          detalle={`${cxp.length} servicio(s) por pagar`}
        />
        <Atajo
          href="/liquidacion"
          titulo="Liquidación"
          cifra={String(porLiquidar.length)}
          detalle="Servicios finalizados por liquidar"
        />
      </div>

      <p className="mt-6 text-xs text-muted">
        Catálogos:{" "}
        <Link href="/unidades" className="text-amber hover:underline">
          unidades
        </Link>{" "}
        ·{" "}
        <Link href="/operadores" className="text-amber hover:underline">
          operadores
        </Link>{" "}
        ·{" "}
        <Link href="/viajes" className="text-amber hover:underline">
          todos los servicios
        </Link>
      </p>
    </>
  );
}

function Atajo({
  href,
  titulo,
  cifra,
  detalle,
  alerta,
}: {
  href: string;
  titulo: string;
  cifra: string;
  detalle: string;
  alerta?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="p-4 transition-colors hover:bg-black/[0.02]">
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{cifra}</p>
        <p className={`mt-1 text-xs ${alerta ? "text-rose-700" : "text-muted"}`}>
          {detalle}
        </p>
      </Card>
    </Link>
  );
}

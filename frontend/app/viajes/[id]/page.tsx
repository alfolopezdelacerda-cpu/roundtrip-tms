"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import {
  ESTADOS_VIAJE,
  MODALIDAD_LABEL,
  margen,
  rutaTexto,
  vencimientoCobro,
  type EstadoViaje,
} from "@/lib/types";
import { fecha, fechaHora, km, mxn } from "@/lib/format";
import { Card, PageTitle, Pill } from "@/components/ui";
import {
  AsignacionBadge,
  Barra,
  CobroBadge,
  EstadoBadge,
  PagoBadge,
  TemperaturaBadge,
} from "@/components/servicios";

export default function DetalleViaje() {
  const params = useParams<{ id: string }>();
  const {
    viajes,
    unidad,
    operador,
    proveedor,
    ejecutor,
    nombreDe,
    esFull,
    cambiarEstado,
  } = useStore();
  const viaje = viajes.find((v) => v.id === params.id);

  if (!viaje) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted">
          No se encontró el servicio.{" "}
          <Link href="/viajes" className="text-amber hover:underline">
            Volver a servicios
          </Link>
        </p>
      </Card>
    );
  }

  const u = unidad(viaje.unidadId);
  const o = operador(viaje.operadorId);
  const p = proveedor(viaje.proveedorId);
  const ingresoKm = viaje.km ? viaje.tarifa / viaje.km : 0;
  const m = margen(viaje);
  const pctMargen = viaje.tarifa ? Math.round((m / viaje.tarifa) * 100) : 0;
  const vence = vencimientoCobro(viaje);

  return (
    <>
      <PageTitle
        title={rutaTexto(viaje)}
        subtitle={`${viaje.folio} · ${viaje.cliente} · Carta porte ${viaje.cartaPorte}`}
        action={
          <Link
            href={viaje.asignacion === "TDC" ? "/asignacion-tdc" : "/asignacion-fwd"}
            className="rounded-md border border-line px-3 py-2 text-sm hover:bg-black/[0.03]"
          >
            Volver
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-sm font-semibold">Detalle del servicio</h2>
            <AsignacionBadge asignacion={viaje.asignacion} />
            <TemperaturaBadge temperatura={viaje.temperatura} />
            <EstadoBadge estado={viaje.estado} />
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Dato k="Cliente" v={viaje.cliente} />
            <Dato k="Origen" v={viaje.origen} />
            <Dato k="Destino" v={viaje.destino} />
            <Dato k="Puerto" v={nombreDe("puertos", viaje.puertoId)} />
            <Dato k="Cita de carga" v={fechaHora(viaje.citaCarga)} />
            <Dato k="Cita de descarga" v={fechaHora(viaje.citaDescarga)} />
            <Dato k="Tipo de negocio" v={nombreDe("tiposNegocio", viaje.tipoNegocioId)} />
            <Dato k="Modalidad" v={`${viaje.modalidad} · ${MODALIDAD_LABEL[viaje.modalidad]}`} />
            <Dato k="Tipo de unidad" v={nombreDe("tiposUnidad", viaje.tipoUnidadId)} />
            <Dato k="Tipo de mercancía" v={nombreDe("tiposMercancia", viaje.tipoMercanciaId)} />
            <Dato k="Contenedor 1" v={viaje.contenedor1 || "—"} />
            <Dato
              k="Contenedor 2"
              v={
                esFull(viaje.tipoUnidadId)
                  ? viaje.contenedor2 || "—"
                  : "No aplica"
              }
            />
            <Dato k="Booking" v={viaje.booking || "—"} />
            <Dato k="PO" v={viaje.po || "—"} />
            <Dato k="Carta porte" v={viaje.cartaPorte} />
          </dl>

          <div className="mt-6 border-t border-line pt-4">
            <h3 className="mb-3 text-sm font-semibold">Operación y tarifa</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Dato k="Kilómetros" v={km(viaje.km)} />
              <Dato k="Tarifa al cliente" v={mxn(viaje.tarifa)} />
              <Dato k="Costo" v={mxn(viaje.costo)} />
              <Dato
                k="Margen"
                v={
                  <span className={m < 0 ? "text-rose-700" : undefined}>
                    {mxn(m)} ({pctMargen}%)
                  </span>
                }
              />
              <Dato
                k="Ingreso por km"
                v={ingresoKm ? `${mxn(Math.round(ingresoKm))}/km` : "—"}
              />
              <Dato k="Ejecuta" v={ejecutor(viaje)} />
              {viaje.asignacion === "TDC" ? (
                <>
                  <Dato k="Unidad" v={u ? `${u.economico} · ${u.placas}` : "Sin asignar"} />
                  <Dato k="Operador" v={o ? `${o.nombre} · ${o.celular}` : "Sin asignar"} />
                </>
              ) : (
                <>
                  <Dato k="Proveedor" v={p?.nombre ?? "Sin proveedor"} />
                  <Dato k="Contacto" v={p?.contacto ?? "—"} />
                </>
              )}
            </dl>
          </div>

          {viaje.notas ? (
            <p className="mt-5 rounded-md bg-black/[0.03] px-3 py-2 text-sm text-muted">
              {viaje.notas}
            </p>
          ) : null}

          <div className="mt-6 border-t border-line pt-4">
            <h3 className="mb-3 text-sm font-semibold">Situación financiera</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Dato k="Cobro" v={<CobroBadge estado={viaje.cobro.estado} />} />
              <Dato k="Factura" v={viaje.cobro.factura ?? "—"} />
              <Dato k="Vence" v={vence ? fecha(vence) : "—"} />
              <Dato k="Pago" v={<PagoBadge estado={viaje.pago.estado} />} />
              <Dato k="Referencia" v={viaje.pago.referencia ?? "—"} />
              <Dato
                k="Liquidación"
                v={
                  viaje.liquidacion.estado === "liquidado"
                    ? `Liquidado ${fecha(viaje.liquidacion.fecha ?? "")}`
                    : "Pendiente"
                }
              />
            </dl>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Monitoreo</h2>
            <Barra valor={viaje.monitoreo.avance} />
            <dl className="mt-4 space-y-3 text-sm">
              <Dato k="Ubicación" v={viaje.monitoreo.ubicacion} />
              <Dato
                k="Actualizado"
                v={new Date(viaje.monitoreo.actualizado).toLocaleString("es-MX", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            </dl>
            <p className="mt-3 rounded-md bg-black/[0.03] px-3 py-2 text-sm text-muted">
              {viaje.monitoreo.ultimoEvento}
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Actualizar estado</h2>
            <div className="flex flex-col gap-2">
              {ESTADOS_VIAJE.map((e) => (
                <button
                  key={e.value}
                  onClick={() => cambiarEstado(viaje.id, e.value as EstadoViaje)}
                  className={`rounded-md px-3 py-2 text-left text-sm ring-1 ring-inset transition-colors ${
                    viaje.estado === e.value
                      ? "bg-ink text-white ring-transparent"
                      : "bg-white ring-[#DEE3DD] hover:bg-black/[0.03]"
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">
              Los cambios se guardan en este navegador.
            </p>
            {viaje.asignacion === "TDC" && u ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>{u.tipo}</Pill>
                <Pill>{u.capacidadTon} t</Pill>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}

function Dato({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
      <dd className="mt-1 font-medium">{v}</dd>
    </div>
  );
}

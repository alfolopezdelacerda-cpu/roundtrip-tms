"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Menú principal, en el orden del flujo operativo: se da de alta el servicio,
 * se asigna (a la transportadora o a un proveedor), se monitorea y al cerrar
 * pasa a cobranza, pago y liquidación.
 */
const links = [
  { href: "/viajes/nuevo", label: "Nuevo Viaje" },
  { href: "/asignacion-tdc", label: "Asignación TDC" },
  { href: "/asignacion-fwd", label: "Asignación FWD" },
  { href: "/monitoreo", label: "Monitoreo" },
  { href: "/cxc", label: "CXC" },
  { href: "/cxp", label: "CXP" },
  { href: "/liquidacion", label: "Liquidación" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-ink text-[#F2F3EF]">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight"
          title="Tablero"
        >
          Roundtrip <span className="text-amber">TMS</span>
        </Link>

        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {links.map((l) => {
            const activo = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-2.5 py-1.5 transition-colors ${
                  activo
                    ? "bg-white/15 font-medium text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";

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

/** Clics seguidos sobre el logo que abren el administrador, y su ventana. */
const CLICS_ADMIN = 3;
const VENTANA_MS = 1200;

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const clics = useRef<number[]>([]);

  /**
   * El logo sigue llevando al tablero con un clic normal. Tres clics seguidos
   * abren el administrador oculto: así el acceso existe sin ocupar sitio en
   * el menú ni quitarle al logo su función habitual.
   */
  function alClicLogo(e: React.MouseEvent) {
    const ahora = Date.now();
    clics.current = [...clics.current, ahora].filter((t) => ahora - t < VENTANA_MS);

    if (clics.current.length >= CLICS_ADMIN) {
      e.preventDefault();
      clics.current = [];
      router.push("/admin");
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-ink text-[#F2F3EF]">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          href="/"
          onClick={alClicLogo}
          className="select-none text-sm font-semibold tracking-tight"
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

        {pathname.startsWith("/admin") ? (
          <span className="ml-auto rounded-full bg-amber/20 px-2.5 py-0.5 text-xs font-medium text-amber">
            Administrador
          </span>
        ) : null}
      </div>
    </header>
  );
}

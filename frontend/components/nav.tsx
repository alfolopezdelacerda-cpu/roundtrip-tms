"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { AREAS_MENU } from "@/lib/menu";

/** Clics seguidos sobre el logo que abren el administrador, y su ventana. */
const CLICS_ADMIN = 3;
const VENTANA_MS = 1200;

/**
 * Menú por áreas de la operación, cada una con sus submenús. Vive como
 * barra lateral a la izquierda, de alto completo. El área que contiene la
 * página activa arranca abierta; las demás se despliegan con un clic.
 */
export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const clics = useRef<number[]>([]);
  const { usuario, salir, modo } = useStore();

  const areaActiva = useMemo(
    () =>
      AREAS_MENU.find((a) =>
        a.items.some(
          (i) =>
            pathname.startsWith(i.href) ||
            i.hijos?.some((h) => pathname.startsWith(h.href)),
        ),
      )?.slug,
    [pathname],
  );

  const [abiertas, setAbiertas] = useState<Set<string>>(
    () => new Set(areaActiva ? [areaActiva] : []),
  );

  function alternar(slug: string) {
    setAbiertas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(slug)) siguiente.delete(slug);
      else siguiente.add(slug);
      return siguiente;
    });
  }

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
    <header className="sticky top-0 z-10 flex h-fit w-full flex-col border-b border-line bg-ink text-[#F2F3EF] sm:h-screen sm:w-64 sm:shrink-0 sm:border-b-0 sm:border-r">
      <div className="flex items-center gap-2 px-4 py-4">
        <Link
          href="/"
          onClick={alClicLogo}
          className="select-none text-sm font-semibold tracking-tight"
          title="Tablero"
        >
          Roundtrip <span className="text-amber">TMS</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-1 text-sm">
        {AREAS_MENU.map((area) => {
          const abierta = abiertas.has(area.slug) || area.slug === areaActiva;
          return (
            <div key={area.slug}>
              <button
                type="button"
                onClick={() => alternar(area.slug)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left font-medium transition-colors ${
                  area.slug === areaActiva
                    ? "text-white"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {area.titulo}
                <span className={`text-xs transition-transform ${abierta ? "rotate-90" : ""}`}>
                  ›
                </span>
              </button>

              {abierta ? (
                <div className="ml-2 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                  {area.items.map((item) => (
                    <ItemNav key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2 border-t border-white/10 px-4 py-3">
        {pathname.startsWith("/admin") ? (
          <span className="w-fit rounded-full bg-amber/20 px-2.5 py-0.5 text-xs font-medium text-amber">
            Administrador
          </span>
        ) : null}

        {modo === "demo" ? (
          <span className="w-fit rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">
            demo
          </span>
        ) : null}

        {usuario ? (
          <>
            <span className="truncate text-xs text-white/70">
              {usuario.email} · {usuario.role}
            </span>
            <button
              onClick={() => void salir()}
              className="w-fit rounded-md px-2.5 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              Salir
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}

function ItemNav({
  item,
  pathname,
}: {
  item: (typeof AREAS_MENU)[number]["items"][number];
  pathname: string;
}) {
  const activo = pathname.startsWith(item.href);

  return (
    <div>
      <Link
        href={item.href}
        className={`block rounded-md px-3 py-1.5 text-[13px] transition-colors ${
          activo && !item.hijos
            ? "bg-white/15 font-medium text-white"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        }`}
      >
        {item.titulo}
      </Link>
      {item.hijos ? (
        <div className="ml-2 flex flex-col gap-0.5 border-l border-white/10 pl-3">
          {item.hijos.map((hijo) => {
            const hijoActivo = pathname.startsWith(hijo.href);
            return (
              <Link
                key={hijo.href}
                href={hijo.href}
                className={`block rounded-md px-3 py-1 text-xs transition-colors ${
                  hijoActivo
                    ? "bg-white/15 font-medium text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {hijo.titulo}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

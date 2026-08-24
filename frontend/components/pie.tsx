"use client";

import { useStore } from "@/lib/store";

/** El pie dice de dónde salen los datos: es la diferencia entre demo y real. */
export function PieDePagina() {
  const { modo } = useStore();

  return (
    <footer className="px-4 pb-8 pt-4 text-xs text-muted sm:px-6">
      Roundtrip TMS ·{" "}
      {modo === "api"
        ? "conectado a la API"
        : "modo demostración, datos de ejemplo en este navegador"}
    </footer>
  );
}

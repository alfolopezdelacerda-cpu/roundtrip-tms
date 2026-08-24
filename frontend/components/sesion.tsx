"use client";

import { useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { Card } from "./ui";

/**
 * Portero de la aplicación.
 *
 * En modo API no deja ver nada sin sesión; en modo demostración pasa de
 * largo. Va aquí y no en un middleware porque la sesión vive en el navegador:
 * el servidor de Next no la conoce y redirigir desde el borde solo produciría
 * parpadeos.
 */
export function Sesion({ children }: { children: ReactNode }) {
  const { necesitaLogin, cargando, modo, error } = useStore();

  if (necesitaLogin) return <PantallaLogin />;

  if (cargando) {
    return (
      <div className="px-4 py-16 text-center text-sm text-muted sm:px-6">
        Cargando datos…
      </div>
    );
  }

  return (
    <>
      {modo === "demo" ? <AvisoDemo /> : null}
      {error ? <Aviso mensaje={error} /> : null}
      {children}
    </>
  );
}

function AvisoDemo() {
  return (
    <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
      <strong className="font-semibold">Modo demostración.</strong> No hay API
      configurada, así que los datos son de ejemplo y se guardan solo en este
      navegador. Para conectar el backend, define{" "}
      <code className="font-mono text-xs">NEXT_PUBLIC_API_URL</code>.
    </div>
  );
}

function Aviso({ mensaje }: { mensaje: string }) {
  return (
    <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
      {mensaje}
    </div>
  );
}

function PantallaLogin() {
  const { entrar } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [pideMfa, setPideMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await entrar(email, password, mfaCode || undefined);
    } catch (err) {
      const detalle = (err as { detalle?: { mfaRequerido?: boolean } }).detalle;
      // El backend responde 401 con `mfaRequerido` cuando falta el segundo
      // factor: no es un error de credenciales, es un paso más.
      if (detalle?.mfaRequerido) {
        setPideMfa(true);
        setError("Ingresa el código de tu autenticador.");
      } else {
        setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
      }
    } finally {
      setEnviando(false);
    }
  }

  const campo =
    "w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-amber";

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold tracking-tight">
          Roundtrip <span className="text-amber">TMS</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Inicia sesión para continuar.</p>

        <form onSubmit={enviar} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="correo"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted"
            >
              Correo
            </label>
            <input
              id="correo"
              type="email"
              autoComplete="username"
              className={campo}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className={campo}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {pideMfa ? (
            <div>
              <label
                htmlFor="mfa"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted"
              >
                Código MFA
              </label>
              <input
                id="mfa"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className={campo}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          ) : null}

          {error ? (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-md bg-amber px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </Card>
    </div>
  );
}

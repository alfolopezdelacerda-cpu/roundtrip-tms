/**
 * Cliente HTTP de la API.
 *
 * Guarda el par de tokens en `localStorage` y, ante un 401, intenta renovarlo
 * una sola vez antes de rendirse: el access token dura 15 minutos y sin esto
 * la sesión se caería a media captura.
 */

const CLAVE_TOKENS = "roundtrip-tms:sesion";

/** Si no hay URL configurada, la aplicación corre en modo demostración. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

// Conectado a la API persistente en Vercel (backend serverless)
export const hayApi = API_URL !== "";

export type Sesion = {
  accessToken: string;
  refreshToken: string;
  usuario?: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
};

export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
    readonly detalle?: unknown,
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}

// ---- Sesión ----

export function leerSesion(): Sesion | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CLAVE_TOKENS);
    return raw ? (JSON.parse(raw) as Sesion) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion: Sesion | null): void {
  if (typeof window === "undefined") return;
  try {
    if (sesion) window.localStorage.setItem(CLAVE_TOKENS, JSON.stringify(sesion));
    else window.localStorage.removeItem(CLAVE_TOKENS);
  } catch {
    // modo privado o sin cuota: la sesión vivirá solo en memoria
  }
}

/** Se avisa a la aplicación cuando la sesión caduca de verdad. */
type OyenteSesion = () => void;
const oyentes = new Set<OyenteSesion>();

export function alPerderSesion(oyente: OyenteSesion): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

function perderSesion() {
  guardarSesion(null);
  for (const oyente of oyentes) oyente();
}

// ---- Peticiones ----

type Opciones = {
  metodo?: "GET" | "POST" | "PATCH" | "DELETE";
  cuerpo?: unknown;
  /** Uso interno: evita reintentar el refresh en bucle. */
  reintento?: boolean;
};

export async function peticion<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  if (!hayApi) {
    throw new ErrorApi(0, "No hay API configurada (modo demostración)");
  }

  const sesion = leerSesion();
  const cabeceras: Record<string, string> = { "Content-Type": "application/json" };
  if (sesion?.accessToken) {
    cabeceras.Authorization = `Bearer ${sesion.accessToken}`;
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method: opciones.metodo ?? "GET",
      headers: cabeceras,
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
    });
  } catch {
    throw new ErrorApi(0, "No se pudo contactar la API");
  }

  // Token vencido: se renueva una vez y se repite la petición original.
  if (respuesta.status === 401 && sesion?.refreshToken && !opciones.reintento) {
    const renovada = await renovar(sesion.refreshToken);
    if (renovada) return peticion<T>(ruta, { ...opciones, reintento: true });
    perderSesion();
  }

  if (respuesta.status === 204) return undefined as T;

  const texto = await respuesta.text();
  const datos = texto ? seguroJson(texto) : null;

  if (!respuesta.ok) {
    if (respuesta.status === 401) perderSesion();
    throw new ErrorApi(respuesta.status, mensajeDeError(datos, respuesta.status), datos);
  }

  return datos as T;
}

async function renovar(refreshToken: string): Promise<boolean> {
  try {
    const respuesta = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!respuesta.ok) return false;

    const nueva = (await respuesta.json()) as Sesion;
    // El usuario no viene en el refresh: se conserva el que ya se conocía.
    guardarSesion({ ...nueva, usuario: leerSesion()?.usuario });
    return true;
  } catch {
    return false;
  }
}

function seguroJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return { message: texto };
  }
}

/**
 * Saca un mensaje legible de la respuesta. El backend devuelve `errors` con
 * campo y motivo cuando falla la validación; mostrarlos es más útil que un
 * «Validation failed» a secas.
 */
function mensajeDeError(datos: unknown, status: number): string {
  if (datos && typeof datos === "object") {
    const d = datos as {
      message?: string | string[];
      errors?: Array<{ field: string; messages: string[] }>;
      faltantes?: string[];
    };

    if (d.errors?.length) {
      return d.errors.map((e) => `${e.field}: ${e.messages[0]}`).join(" · ");
    }
    if (d.faltantes?.length) {
      return `${d.message ?? "Faltan datos"}: ${d.faltantes.join(", ")}`;
    }
    if (Array.isArray(d.message)) return d.message.join(" · ");
    if (d.message) return d.message;
  }
  return `Error ${status}`;
}

// ---- Autenticación ----

export async function iniciarSesion(email: string, password: string, mfaCode?: string) {
  const respuesta = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, ...(mfaCode ? { mfaCode } : {}) }),
  });

  const datos = (await respuesta.json()) as Record<string, unknown>;

  if (!respuesta.ok) {
    // El backend marca con `mfaRequerido` que falta el segundo factor.
    throw new ErrorApi(
      respuesta.status,
      mensajeDeError(datos, respuesta.status),
      datos,
    );
  }

  const sesion = datos as unknown as Sesion;
  guardarSesion(sesion);

  const usuario = await peticion<Sesion["usuario"]>("/api/v1/auth/me");
  guardarSesion({ ...sesion, usuario });
  return usuario;
}

export async function cerrarSesion(): Promise<void> {
  const sesion = leerSesion();
  try {
    if (sesion) {
      await peticion("/api/v1/auth/logout", {
        metodo: "POST",
        cuerpo: { refreshToken: sesion.refreshToken },
      });
    }
  } catch {
    // Si el servidor no responde, la sesión local se cierra igual.
  } finally {
    perderSesion();
  }
}

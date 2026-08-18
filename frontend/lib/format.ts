export function mxn(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

export function km(n: number) {
  return `${new Intl.NumberFormat("es-MX").format(n)} km`;
}

/**
 * Cita con fecha y hora (`YYYY-MM-DDTHH:mm`).
 *
 * Se formatea a mano en vez de con `new Date(...)` porque las citas son hora
 * local del sitio de carga: convertirlas a la zona del navegador movería la
 * hora que el cliente confirmó.
 */
export function fechaHora(iso: string) {
  if (!iso) return "—";
  const [dia, hora] = iso.split("T");
  if (!hora) return fecha(dia);
  return `${fecha(dia)} ${hora.slice(0, 5)}`;
}

export function fecha(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

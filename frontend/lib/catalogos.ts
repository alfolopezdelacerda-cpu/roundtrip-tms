/**
 * Catálogos del sistema.
 *
 * Todo lo que en el alta de viaje es una lista desplegable vive aquí y se
 * mantiene desde el administrador oculto. Se guardan con `activo` en vez de
 * borrarse: un catálogo dado de baja debe seguir resolviendo el nombre de los
 * servicios históricos que lo usaron.
 */

export type ItemCatalogo = {
  id: string;
  nombre: string;
  activo: boolean;
};

export type Cliente = ItemCatalogo & {
  /** Días de crédito por defecto al dar de alta un servicio. */
  diasCredito: number;
  rfc: string;
};

export type TipoUnidad = ItemCatalogo & {
  /** Si es full, el servicio admite un segundo contenedor. */
  full: boolean;
};

export type ClaveCatalogo =
  | "clientes"
  | "proveedores"
  | "unidades"
  | "operadores"
  | "puertos"
  | "tiposNegocio"
  | "tiposUnidad"
  | "tiposMercancia"
  | "rutas"
  | "tarifas";

export const clientesSeed: Cliente[] = [
  { id: "c1", nombre: "Grupo Ferretero del Norte", rfc: "GFN050312AB1", diasCredito: 30, activo: true },
  { id: "c2", nombre: "Alimentos La Huerta", rfc: "ALH980722KJ4", diasCredito: 30, activo: true },
  { id: "c3", nombre: "Distribuidora Peninsular", rfc: "DPE110204RT8", diasCredito: 15, activo: true },
  { id: "c4", nombre: "Cementos del Bajío", rfc: "CBA020918MN2", diasCredito: 30, activo: true },
  { id: "c5", nombre: "Comercializadora Andina", rfc: "CAN150630PL9", diasCredito: 45, activo: true },
  { id: "c6", nombre: "Textiles del Valle", rfc: "TVA070415QW3", diasCredito: 45, activo: true },
];

export const puertosSeed: ItemCatalogo[] = [
  { id: "pt1", nombre: "Manzanillo", activo: true },
  { id: "pt2", nombre: "Lázaro Cárdenas", activo: true },
  { id: "pt3", nombre: "Veracruz", activo: true },
  { id: "pt4", nombre: "Altamira", activo: true },
  { id: "pt5", nombre: "Ensenada", activo: true },
  { id: "pt6", nombre: "Progreso", activo: true },
  { id: "pt7", nombre: "Nuevo Laredo (frontera)", activo: true },
  { id: "pt8", nombre: "No aplica", activo: true },
];

export const tiposNegocioSeed: ItemCatalogo[] = [
  { id: "tn1", nombre: "Dedicado", activo: true },
  { id: "tn2", nombre: "Expo", activo: true },
  { id: "tn3", nombre: "Impo", activo: true },
  { id: "tn4", nombre: "Local", activo: true },
  { id: "tn5", nombre: "Nacional", activo: true },
  { id: "tn6", nombre: "Cross border", activo: true },
];

export const tiposUnidadSeed: TipoUnidad[] = [
  { id: "tu1", nombre: "Sencillo 48'", full: false, activo: true },
  { id: "tu2", nombre: "Sencillo 53'", full: false, activo: true },
  { id: "tu3", nombre: "Full", full: true, activo: true },
  { id: "tu4", nombre: "Chasis portacontenedor 40'", full: false, activo: true },
  { id: "tu5", nombre: "Chasis doble 2x20'", full: true, activo: true },
  { id: "tu6", nombre: "Rabón", full: false, activo: true },
  { id: "tu7", nombre: "Camioneta 3.5", full: false, activo: true },
];

export const tiposMercanciaSeed: ItemCatalogo[] = [
  { id: "tm1", nombre: "Carga general", activo: true },
  { id: "tm2", nombre: "Perecedero", activo: true },
  { id: "tm3", nombre: "Material peligroso", activo: true },
  { id: "tm4", nombre: "Frágil", activo: true },
  { id: "tm5", nombre: "Automotriz", activo: true },
  { id: "tm6", nombre: "Textil", activo: true },
  { id: "tm7", nombre: "Materiales de construcción", activo: true },
];

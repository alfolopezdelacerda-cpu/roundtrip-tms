/**
 * Estructura del menú por áreas. Cada submenú apunta a una página real
 * cuando ya existe; el resto cae en la ruta genérica `/{area}/{submenu}`,
 * que renderiza un "Próximamente" — así la navegación completa está viva
 * desde hoy aunque el módulo aún no se haya construido.
 */
export type ItemMenu = {
  titulo: string;
  href: string;
  /** Solo "Asignación" lo usa hoy: TDC y FWD son dos páginas ya existentes. */
  hijos?: { titulo: string; href: string }[];
};

export type AreaMenu = {
  slug: string;
  titulo: string;
  items: ItemMenu[];
};

export const AREAS_MENU: AreaMenu[] = [
  {
    slug: "atc",
    titulo: "ATC",
    items: [
      { titulo: "CRM", href: "/atc/crm" },
      { titulo: "Solicitudes", href: "/viajes/nuevo" },
      { titulo: "Clasificación", href: "/atc/clasificacion" },
      { titulo: "Tarifario", href: "/atc/tarifario" },
    ],
  },
  {
    slug: "operaciones",
    titulo: "Operaciones",
    items: [
      {
        titulo: "Asignación",
        href: "/asignacion-tdc",
        hijos: [
          { titulo: "TDC", href: "/asignacion-tdc" },
          { titulo: "FWD", href: "/asignacion-fwd" },
        ],
      },
      { titulo: "Solicitar gastos", href: "/operaciones/solicitar-gastos" },
      { titulo: "Tracking", href: "/monitoreo" },
      { titulo: "Planificación", href: "/operaciones/planificacion" },
      { titulo: "Liquidación de servicios", href: "/liquidacion" },
      { titulo: "Combustible", href: "/operaciones/combustible" },
    ],
  },
  {
    slug: "seguridad",
    titulo: "Seguridad",
    items: [
      { titulo: "Monitoreo", href: "/seguridad/monitoreo" },
      { titulo: "Incidencias", href: "/seguridad/incidencias" },
      { titulo: "Rutas", href: "/seguridad/rutas" },
      { titulo: "Pruebas de dispositivos", href: "/seguridad/pruebas-dispositivos" },
      { titulo: "Antidoping", href: "/seguridad/antidoping" },
      { titulo: "Reporteo", href: "/seguridad/reporteo" },
      { titulo: "Protocolos", href: "/seguridad/protocolos" },
      { titulo: "Análisis de Riesgo", href: "/seguridad/analisis-riesgo" },
    ],
  },
  {
    slug: "rrhh",
    titulo: "RRHH",
    items: [
      { titulo: "Personal administrativo", href: "/rrhh/personal-administrativo" },
      { titulo: "Operadores", href: "/operadores" },
      { titulo: "Documentación", href: "/rrhh/documentacion" },
      { titulo: "Capacitaciones", href: "/rrhh/capacitaciones" },
      { titulo: "Nómina", href: "/rrhh/nomina" },
      { titulo: "Reclutamiento", href: "/rrhh/reclutamiento" },
      { titulo: "Asistencia", href: "/rrhh/asistencia" },
    ],
  },
  {
    slug: "calidad",
    titulo: "Calidad",
    items: [
      { titulo: "SGS", href: "/calidad/sgs" },
      { titulo: "Auditorías", href: "/calidad/auditorias" },
      { titulo: "Planes de acción", href: "/calidad/planes-de-accion" },
      { titulo: "Capacitaciones", href: "/calidad/capacitaciones" },
      { titulo: "Seguimiento de Pendientes", href: "/calidad/seguimiento-pendientes" },
      { titulo: "Satisfacción del Cliente", href: "/calidad/satisfaccion-cliente" },
    ],
  },
  {
    slug: "mantenimiento",
    titulo: "Mantenimiento",
    items: [
      { titulo: "Almacén y Refacciones", href: "/mantenimiento/almacen-refacciones" },
      { titulo: "Inventario", href: "/mantenimiento/inventario" },
      { titulo: "Órdenes de Trabajo", href: "/mantenimiento/ordenes-trabajo" },
      { titulo: "Calendario", href: "/mantenimiento/calendario" },
      { titulo: "Reportes", href: "/mantenimiento/reportes" },
      { titulo: "Gestión de Llantas", href: "/mantenimiento/gestion-llantas" },
    ],
  },
  {
    slug: "finanzas",
    titulo: "Finanzas",
    items: [
      { titulo: "CXP", href: "/cxp" },
      { titulo: "CXC", href: "/cxc" },
      { titulo: "Gastos", href: "/finanzas/gastos" },
      { titulo: "Facturación", href: "/finanzas/facturacion" },
      { titulo: "Rentabilidad por Viaje", href: "/finanzas/rentabilidad-viaje" },
    ],
  },
];

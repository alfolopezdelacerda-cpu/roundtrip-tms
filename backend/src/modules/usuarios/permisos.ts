import type { RolUsuario } from '../auth/entities/user.entity';

/**
 * Qué puede hacer cada rol, en el lenguaje de la operación.
 *
 * Es la lectura humana de los `@Roles(...)` repartidos por los
 * controladores: describe lo mismo que ya aplica `RolesGuard`, para que el
 * administrador lo consulte sin abrir el código. Al cambiar un `@Roles`,
 * cambiar también la línea correspondiente de aquí.
 */
export type Permiso = {
  area: string;
  accion: string;
  roles: RolUsuario[];
};

export const PERMISOS: Permiso[] = [
  {
    area: 'Servicios',
    accion: 'Consultar servicios y el tablero',
    roles: ['admin', 'manager', 'dispatcher', 'accountant', 'driver'],
  },
  {
    area: 'Servicios',
    accion: 'Dar de alta y editar servicios',
    roles: ['admin', 'manager', 'dispatcher'],
  },
  {
    area: 'Servicios',
    accion: 'Asignar unidad, operador o proveedor',
    roles: ['admin', 'manager', 'dispatcher'],
  },
  {
    area: 'Monitoreo',
    accion: 'Cambiar estatus y capturar seguimiento',
    roles: ['admin', 'manager', 'dispatcher'],
  },
  {
    area: 'Finanzas',
    accion: 'Facturar y marcar cobrado (CXC)',
    roles: ['admin', 'manager', 'accountant'],
  },
  {
    area: 'Finanzas',
    accion: 'Autorizar y marcar pagado (CXP)',
    roles: ['admin', 'manager', 'accountant'],
  },
  {
    area: 'Finanzas',
    accion: 'Capturar costo operativo y liquidar',
    roles: ['admin', 'manager', 'accountant'],
  },
  {
    area: 'Catálogos',
    accion: 'Crear y editar catálogos (flota, rutas, tarifas, clientes…)',
    roles: ['admin', 'manager'],
  },
  {
    area: 'SAT',
    accion: 'Generar, timbrar y cancelar carta porte',
    roles: ['admin', 'manager'],
  },
  {
    area: 'Administración',
    accion: 'Crear usuarios, asignar roles y restablecer contraseñas',
    roles: ['admin'],
  },
];

/** La misma matriz indexada por rol, que es como la consulta el panel. */
export const PERMISOS_POR_ROL: Record<RolUsuario, string[]> = PERMISOS.reduce(
  (acc, permiso) => {
    for (const rol of permiso.roles) {
      acc[rol] = [...(acc[rol] ?? []), `${permiso.area}: ${permiso.accion}`];
    }
    return acc;
  },
  {} as Record<RolUsuario, string[]>,
);

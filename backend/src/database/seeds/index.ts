import 'reflect-metadata';
import { randomBytes, pbkdf2Sync } from 'crypto';
import { transportesDataSource } from '../data-source';
import { User } from '../../modules/auth/entities/user.entity';
import {
  Cliente,
  Proveedor,
  Puerto,
  TipoMercancia,
  TipoNegocio,
  TipoUnidad,
} from '../entities/catalogos.entities';
import { Conductor, Vehiculo } from '../entities/transportes.entities';
import { Servicio } from '../entities/servicio.entity';

/**
 * Datos iniciales: catálogos, flota, un usuario admin y unos servicios de
 * ejemplo. Es idempotente —si ya hay clientes, no vuelve a sembrar— para
 * poder ejecutarlo sin miedo sobre una base ya usada.
 *
 * Uso: npm run db:seed
 */

/** Mismo formato `salt:hash` que produce EncryptionService.hashPassword. */
function hashPassword(password: string): string {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  const ds = await transportesDataSource.initialize();
  console.log('Conectado a transportes_db');

  const yaSembrado = await ds.getRepository(Cliente).count();
  if (yaSembrado > 0) {
    console.log('La base ya tiene catálogos; no se siembra nada.');
    await ds.destroy();
    return;
  }

  // ---- Usuario admin ----
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    // Nunca una contraseña por defecto: sería la primera puerta abierta.
    throw new Error(
      'Defina SEED_ADMIN_PASSWORD (mínimo 12 caracteres) antes de sembrar.',
    );
  }
  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres.');
  }

  const admin = await ds.getRepository(User).save({
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@adl.mx',
    username: 'admin',
    passwordHash: hashPassword(password),
    firstName: 'Administrador',
    role: 'admin' as const,
  });
  console.log(`Usuario admin: ${admin.email}`);

  // ---- Catálogos ----
  const puertos = await ds.getRepository(Puerto).save(
    [
      'Manzanillo',
      'Lázaro Cárdenas',
      'Veracruz',
      'Altamira',
      'Ensenada',
      'Progreso',
      'Nuevo Laredo (frontera)',
      'No aplica',
    ].map((nombre) => ({ nombre })),
  );

  const tiposNegocio = await ds.getRepository(TipoNegocio).save(
    ['Dedicado', 'Expo', 'Impo', 'Local', 'Nacional', 'Cross border'].map(
      (nombre) => ({ nombre }),
    ),
  );

  const tiposUnidad = await ds.getRepository(TipoUnidad).save([
    { nombre: "Sencillo 48'", full: false },
    { nombre: "Sencillo 53'", full: false },
    { nombre: 'Full', full: true },
    { nombre: "Chasis portacontenedor 40'", full: false },
    { nombre: "Chasis doble 2x20'", full: true },
    { nombre: 'Rabón', full: false },
    { nombre: 'Camioneta 3.5', full: false },
  ]);

  const tiposMercancia = await ds.getRepository(TipoMercancia).save(
    [
      'Carga general',
      'Perecedero',
      'Material peligroso',
      'Frágil',
      'Automotriz',
      'Textil',
      'Materiales de construcción',
    ].map((nombre) => ({ nombre })),
  );

  const clientes = await ds.getRepository(Cliente).save([
    { nombre: 'Grupo Ferretero del Norte', diasCredito: 30 },
    { nombre: 'Alimentos La Huerta', diasCredito: 30 },
    { nombre: 'Distribuidora Peninsular', diasCredito: 15 },
    { nombre: 'Cementos del Bajío', diasCredito: 30 },
    { nombre: 'Comercializadora Andina', diasCredito: 45 },
    { nombre: 'Textiles del Valle', diasCredito: 45 },
  ]);

  const proveedores = await ds.getRepository(Proveedor).save([
    { nombre: 'Fletes del Golfo', tipo: 'transportista', diasPago: 30 },
    { nombre: 'Autotransportes Bajío', tipo: 'transportista', diasPago: 45 },
    { nombre: 'Aduanal Terán y Asoc.', tipo: 'agente_aduanal', diasPago: 15 },
    { nombre: 'Almacenes Pacífico', tipo: 'almacen', diasPago: 30 },
  ]);

  // ---- Flota ----
  const vehiculos = await ds.getRepository(Vehiculo).save([
    { economico: 'T-101', placa: 'AB-472-XC', tipo: 'full_trailer' as const, capacidadToneladas: '30.00', estado: 'operativo' as const },
    { economico: 'T-102', placa: 'AB-518-XC', tipo: 'full_trailer' as const, capacidadToneladas: '30.00', estado: 'operativo' as const },
    { economico: 'R-204', placa: 'CD-991-LP', tipo: 'rabon' as const, capacidadToneladas: '10.00', estado: 'operativo' as const },
    { economico: 'R-205', placa: 'CD-014-LP', tipo: 'rabon' as const, capacidadToneladas: '10.00', estado: 'mantenimiento' as const },
    { economico: 'C-310', placa: 'EF-663-MN', tipo: 'pickup' as const, capacidadToneladas: '3.50', estado: 'operativo' as const },
    { economico: 'T-103', placa: 'AB-770-XC', tipo: 'full_trailer' as const, capacidadToneladas: '30.00', estado: 'operativo' as const },
  ]);

  const conductores = await ds.getRepository(Conductor).save([
    { nombreCompleto: 'Javier Robles', licenciaNumero: 'E-4471203', estado: 'activo' as const },
    { nombreCompleto: 'Marisol Aguilar', licenciaNumero: 'E-3390118', estado: 'activo' as const },
    { nombreCompleto: 'Ernesto Padilla', licenciaNumero: 'B-1120994', estado: 'activo' as const },
    { nombreCompleto: 'Luis Fernando Cruz', licenciaNumero: 'E-5583321', estado: 'activo' as const },
    { nombreCompleto: 'Ana Karen Ibarra', licenciaNumero: 'B-7741220', estado: 'activo' as const },
  ]);

  // ---- Servicios de ejemplo ----
  const repoServicios = ds.getRepository(Servicio);
  await repoServicios.save([
    repoServicios.create({
      folio: 'RT-2601',
      cartaPorte: 'CP-2026-2601',
      cliente: clientes[0],
      origen: 'CDMX',
      destino: 'Monterrey',
      puerto: puertos[7],
      citaCarga: new Date('2026-08-12T07:30:00Z'),
      citaDescarga: new Date('2026-08-13T16:00:00Z'),
      asignacion: 'TDC',
      vehiculo: vehiculos[0],
      conductor: conductores[0],
      tipoNegocio: tiposNegocio[0],
      tipoUnidad: tiposUnidad[2],
      tipoMercancia: tiposMercancia[6],
      contenedor1: 'MSCU-4471203',
      contenedor2: 'MSCU-4471204',
      po: 'PO-88231',
      estado: 'en_ruta_vuelta',
      km: 1720,
      tarifa: '48500',
      costo: '31400',
      cobroDiasCredito: 30,
      monitoreoAvance: 78,
      monitoreoUbicacion: 'Saltillo, Coahuila',
      monitoreoUltimoEvento: 'Salida de Apodaca con carga de compensación',
      monitoreoActualizado: new Date('2026-08-15T14:20:00Z'),
    }),
    repoServicios.create({
      folio: 'RT-2604',
      cartaPorte: 'CP-2026-2604',
      cliente: clientes[4],
      origen: 'Manzanillo',
      destino: 'CDMX',
      puerto: puertos[0],
      citaCarga: new Date('2026-08-13T05:00:00Z'),
      citaDescarga: new Date('2026-08-14T11:00:00Z'),
      asignacion: 'FWD',
      proveedorId: proveedores[0].id,
      tipoNegocio: tiposNegocio[2],
      tipoUnidad: tiposUnidad[3],
      tipoMercancia: tiposMercancia[4],
      modalidad: 'OW',
      contenedor1: 'TCLU-7783120',
      booking: 'BKG-556201',
      po: 'PO-77120',
      estado: 'en_ruta_ida',
      km: 1560,
      tarifa: '58900',
      costo: '44200',
      cobroDiasCredito: 45,
      monitoreoAvance: 42,
      monitoreoUbicacion: 'Guadalajara, Jalisco',
      monitoreoUltimoEvento: 'Reporte del proveedor: en tránsito sin novedad',
      monitoreoActualizado: new Date('2026-08-15T10:15:00Z'),
    }),
    repoServicios.create({
      folio: 'RT-2598',
      cartaPorte: 'CP-2026-2598',
      cliente: clientes[0],
      origen: 'CDMX',
      destino: 'Querétaro',
      puerto: puertos[7],
      citaCarga: new Date('2026-08-04T08:00:00Z'),
      citaDescarga: new Date('2026-08-04T18:00:00Z'),
      asignacion: 'TDC',
      vehiculo: vehiculos[5],
      conductor: conductores[4],
      tipoNegocio: tiposNegocio[4],
      tipoUnidad: tiposUnidad[0],
      tipoMercancia: tiposMercancia[6],
      estado: 'completado',
      km: 430,
      tarifa: '14300',
      costo: '8900',
      cobroDiasCredito: 30,
      monitoreoAvance: 100,
      monitoreoUbicacion: 'Patio CDMX',
      monitoreoUltimoEvento: 'Retorno confirmado y evidencia cargada',
      monitoreoActualizado: new Date('2026-08-06T18:40:00Z'),
    }),
  ]);

  console.log(
    `Sembrado: ${clientes.length} clientes, ${puertos.length} puertos, ` +
      `${vehiculos.length} unidades, ${conductores.length} operadores, ` +
      `${proveedores.length} proveedores, 3 servicios.`,
  );

  await ds.destroy();
}

main().catch((error) => {
  console.error('Error al sembrar:', error);
  process.exit(1);
});

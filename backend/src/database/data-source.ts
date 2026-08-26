import 'reflect-metadata';
import { config as cargarEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from '../modules/auth/entities/user.entity';
import { TokenBlacklist } from '../modules/auth/entities/token-blacklist.entity';
import { ENTIDADES_TRANSPORTES } from './entities/transportes.entities';
import { ENTIDADES_CATALOGOS } from './entities/catalogos.entities';
import { Servicio } from './entities/servicio.entity';
import { Incidencia } from './entities/incidencia.entity';
import { CartaPorte } from '../modules/sat/entities/carta-porte.entity';

/**
 * DataSources para el CLI de TypeORM (`migration:generate`, `migration:run`).
 *
 * El CLI no arranca Nest, así que necesita su propia carga de entorno y su
 * propia definición de conexión, separada de `AppModule`.
 */

cargarEnv({ path: process.env.ENV_FILE || '../.env.local' });
cargarEnv({ path: '.env.local' });

export const transportesDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DB_TRANSPORTES_URL,
  entities: [
    User,
    TokenBlacklist,
    ...ENTIDADES_TRANSPORTES,
    ...ENTIDADES_CATALOGOS,
    Servicio,
    Incidencia,
    CartaPorte,
  ],
  migrations: [__dirname + '/migrations/transportes/*.{ts,js}'],
  synchronize: false,
});

export const forwardingDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DB_FORWARDING_URL,
  entities: [],
  migrations: [__dirname + '/migrations/forwarding/*.{ts,js}'],
  synchronize: false,
});

export const monitoreoDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DB_MONITOREO_URL,
  entities: [],
  migrations: [__dirname + '/migrations/monitoreo/*.{ts,js}'],
  synchronize: false,
});

/** Export por defecto: el que usa `npm run db:migrate`. */
export default transportesDataSource;

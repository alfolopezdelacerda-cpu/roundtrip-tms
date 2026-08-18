import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as Joi from 'joi';

import { AuthModule } from './modules/auth/auth.module';
import { CatalogosModule } from './modules/catalogos/catalogos.module';
import { ServiciosModule } from './modules/servicios/servicios.module';
import { EncryptionModule } from './security/encryption/encryption.module';
import { HealthController } from './common/health.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { User } from './modules/auth/entities/user.entity';
import { TokenBlacklist } from './modules/auth/entities/token-blacklist.entity';
import { ENTIDADES_TRANSPORTES } from './database/entities/transportes.entities';
import { ENTIDADES_CATALOGOS } from './database/entities/catalogos.entities';
import { Servicio } from './database/entities/servicio.entity';

/**
 * Módulo raíz.
 *
 * Tres conexiones separadas, como marca docs/DATABASE-SCHEMA.md. `transportes`
 * es la conexión por defecto (sin nombre) porque es donde viven `users` y el
 * grueso del dominio: así `TypeOrmModule.forFeature([...])` sin nombre —como
 * el de AuthModule— resuelve ahí.
 */

const esProduccion = process.env.NODE_ENV === 'production';

function opcionesBase(config: ConfigService, url: string | undefined): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url,
    // `synchronize` jamás en producción: las migraciones son la única vía de
    // cambio de esquema.
    synchronize: !esProduccion && config.get<string>('DB_SYNCHRONIZE') === 'true',
    logging: config.get<string>('DB_LOGGING') === 'true',
    ssl: config.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
    autoLoadEntities: false,
    migrationsRun: false,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '../.env.local', '.env'],
      // Falla al arrancar si falta un secreto crítico, en vez de descubrirlo
      // en la primera petición.
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'staging', 'production')
          .default('development'),
        API_PORT: Joi.number().default(3000),
        DB_TRANSPORTES_URL: Joi.string().required(),
        DB_FORWARDING_URL: Joi.string().required(),
        DB_MONITOREO_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).optional(),
        ENCRYPTION_KEY: Joi.string().min(32).required(),
        KEYCLOAK_URL: Joi.string().uri().optional(),
        KEYCLOAK_REALM: Joi.string().optional(),
        CORS_ORIGIN: Joi.string().optional(),
      }),
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),

    // Conexión por defecto: transportes
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...opcionesBase(config, config.get<string>('DB_TRANSPORTES_URL')),
        entities: [
          User,
          TokenBlacklist,
          ...ENTIDADES_TRANSPORTES,
          ...ENTIDADES_CATALOGOS,
          Servicio,
        ],
        migrations: [__dirname + '/database/migrations/transportes/*.{ts,js}'],
      }),
    }),

    TypeOrmModule.forRootAsync({
      name: 'forwarding',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...opcionesBase(config, config.get<string>('DB_FORWARDING_URL')),
        // Pendiente: entidades de clientes, proveedores y solicitudes de
        // forwarding (ver README).
        entities: [],
        migrations: [__dirname + '/database/migrations/forwarding/*.{ts,js}'],
      }),
    }),

    TypeOrmModule.forRootAsync({
      name: 'monitoreo',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...opcionesBase(config, config.get<string>('DB_MONITOREO_URL')),
        // Pendiente: gps_eventos, incidencias, track_trace_publico y
        // auditoria_sistema (ver README).
        entities: [],
        migrations: [__dirname + '/database/migrations/monitoreo/*.{ts,js}'],
      }),
    }),

    EncryptionModule,
    AuthModule,
    CatalogosModule,
    ServiciosModule,
  ],
  controllers: [HealthController],
  providers: [
    // Cerrado por defecto: todo endpoint pide JWT salvo los marcados @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}

import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from './decorators';

/**
 * Health check.
 *
 * Vive aquí y no en `main.ts` porque `app.get(ruta, handler)` de Nest no
 * registra rutas: `app.get(token)` resuelve un provider del contenedor. Un
 * controlador es la forma correcta y además pasa por los filtros globales.
 */
@Controller()
export class HealthController {
  constructor(
    // `transportes` es la conexión por defecto (ver AppModule), por eso se
    // inyecta sin nombre.
    @InjectDataSource() private readonly transportes: DataSource,
    @InjectDataSource('forwarding') private readonly forwarding: DataSource,
    @InjectDataSource('monitoreo') private readonly monitoreo: DataSource,
  ) {}

  /** Liveness: responde si el proceso está en pie. No toca la base. */
  @Public()
  @Get('health')
  salud() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  /** Readiness: comprueba las tres bases antes de declararse listo. */
  @Public()
  @Get('health/ready')
  async listo() {
    const bases = {
      transportes: this.transportes,
      forwarding: this.forwarding,
      monitoreo: this.monitoreo,
    };

    const resultados = await Promise.all(
      Object.entries(bases).map(async ([nombre, ds]) => {
        try {
          await ds.query('SELECT 1');
          return [nombre, 'ok'] as const;
        } catch {
          return [nombre, 'error'] as const;
        }
      }),
    );

    const detalle = Object.fromEntries(resultados);
    const todoOk = resultados.every(([, estado]) => estado === 'ok');

    return {
      status: todoOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      databases: detalle,
    };
  }
}

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarApp } from './bootstrap';
import logger from './common/logger';

/**
 * Arranque tradicional (servidor de larga duración, `app.listen`). Lo usa
 * el desarrollo local y cualquier host que no sea serverless. En Vercel el
 * arranque real es `api/index.ts`, que reusa `configurarApp` sin `.listen`.
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  configurarApp(app);

  // ============================================
  // HEALTH CHECK
  // ============================================
  // Lo sirve `HealthController` (/health y /health/ready). Aquí no se puede
  // registrar la ruta: `app.get(token)` de Nest resuelve un provider del
  // contenedor, no monta un handler de Express.

  // ============================================
  // INICIAR SERVIDOR
  // ============================================
  const port = process.env.API_PORT || 3000;
  const env = process.env.NODE_ENV || 'development';

  await app.listen(port);

  logger.log(
    `🚀 ROUNDTRIP TMS Backend iniciado en puerto ${port} (${env})`,
    'Bootstrap',
  );

  // Log de configuración de seguridad
  logger.log('🔒 Seguridad activada:', 'Bootstrap');
  logger.log('  ✓ Helmet headers configurados', 'Bootstrap');
  logger.log('  ✓ Rate limiting activo', 'Bootstrap');
  logger.log('  ✓ CORS configurado', 'Bootstrap');
  logger.log('  ✓ Input validation activo', 'Bootstrap');
  logger.log('  ✓ Auditoría global activada', 'Bootstrap');
}

bootstrap().catch((err) => {
  logger.error('❌ Error al iniciar:', err);
  process.exit(1);
});

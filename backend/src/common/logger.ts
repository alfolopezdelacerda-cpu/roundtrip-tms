import * as winston from 'winston';

/**
 * Logger central del backend.
 *
 * Se exporta como instancia (no como provider de Nest) porque `main.ts` y
 * `EncryptionService` lo usan antes o fuera del ciclo de vida de la inyección
 * de dependencias.
 *
 * En desarrollo escribe legible en consola; en el resto de entornos escribe
 * JSON en una sola línea, que es lo que Filebeat/Logstash espera para
 * indexar en Elasticsearch.
 */

const isDev = (process.env.NODE_ENV || 'development') === 'development';

const devFormat = winston.format.printf(({ level, message, timestamp, context, ...meta }) => {
  const ctx = context ? ` [${String(context)}]` : '';
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${String(timestamp)} ${level}${ctx} ${String(message)}${extra}`;
});

const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  defaultMeta: { service: 'roundtrip-tms-backend' },
  format: isDev
    ? winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.colorize({ level: true }),
        devFormat,
      )
    : winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

/**
 * Normaliza el error recibido para no perder el stack ni volcar objetos
 * enormes en el log.
 */
function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { error: error.message, stack: error.stack };
  }
  if (error === undefined || error === null) return {};
  return { error: String(error) };
}

export const logger = {
  log(message: string, context?: string): void {
    winstonLogger.info(message, { context });
  },

  info(message: string, context?: string): void {
    winstonLogger.info(message, { context });
  },

  warn(message: string, context?: string): void {
    winstonLogger.warn(message, { context });
  },

  debug(message: string, context?: string): void {
    winstonLogger.debug(message, { context });
  },

  /**
   * Acepta `error(msg)`, `error(msg, err)` y `error(msg, err, context)`,
   * que son las tres formas que ya usan `main.ts` y `EncryptionService`.
   */
  error(message: string, error?: unknown, context?: string): void {
    winstonLogger.error(message, { context, ...serializeError(error) });
  },

  /** Evento de auditoría: siempre se emite, nunca se filtra por nivel. */
  audit(payload: Record<string, unknown>): void {
    winstonLogger.info('audit', { context: 'Audit', ...payload });
  },
};

export default logger;

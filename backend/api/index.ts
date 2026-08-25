import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import type { Request, Response } from 'express';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/bootstrap';

/**
 * Entrada serverless para Vercel: mismo `AppModule` y `configurarApp` que
 * `src/main.ts`, pero con `app.init()` en vez de `app.listen()` — Vercel es
 * quien atiende el socket, esta función solo procesa la petición.
 *
 * El módulo Nest se arma una sola vez por instancia tibia (variable de
 * módulo, sobrevive entre invocaciones del mismo contenedor) para no pagar
 * el costo de bootstrap en cada request.
 */
let servidorExpress: express.Express | null = null;
let inicializando: Promise<express.Express> | null = null;

async function obtenerServidor(): Promise<express.Express> {
  if (servidorExpress) return servidorExpress;
  if (!inicializando) {
    inicializando = (async () => {
      const instancia = express();
      const app = await NestFactory.create<NestExpressApplication>(
        AppModule,
        new ExpressAdapter(instancia),
        { logger: ['error', 'warn', 'log'] },
      );
      configurarApp(app);
      await app.init();
      servidorExpress = instancia;
      return instancia;
    })();
  }
  return inicializando;
}

export default async function handler(req: Request, res: Response) {
  const servidor = await obtenerServidor();
  servidor(req, res);
}

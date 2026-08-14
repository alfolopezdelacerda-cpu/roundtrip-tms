# Roundtrip TMS

Monorepo del TMS de ADL: transportes, forwarding y monitoreo.

```
roundtrip-tms/
├── backend/     NestJS + TypeORM + Keycloak (3 Postgres + Redis + ELK vía Docker)
├── frontend/    Next.js 16 (App Router) — portal operativo
├── docs/        DATABASE-SCHEMA.md, CLAUDE-CODE-SETUP.md
└── .env.example
```

## Estado actual

| Pieza | Estado |
|---|---|
| `frontend/` | ✅ Desplegado en Vercel. Tablero, viajes (listado/alta/detalle), unidades, operadores. Datos demo en `localStorage`, sin API todavía. |
| `backend/` | ✅ Compila y arranca. Autenticación completa: login, JWT con rotación de refresh, revocación, MFA (TOTP), RBAC y cifrado AES-256-GCM. |
| Entidades transportes | ✅ `users`, `token_blacklist`, `conductores`, `vehiculos`, `solicitudes_transportes`, `liquidaciones`, `gastos_operativos`. |
| Entidades forwarding y monitoreo | ❌ Pendientes. Las conexiones existen y responden, pero sin entidades. |
| Migraciones y seeds | ❌ Pendientes. En desarrollo el esquema se crea con `DB_SYNCHRONIZE=true`. |
| Módulos de negocio | ❌ Pendientes: `transportes`, `forwarding`, `monitoreo`, `sat` (carta porte CFDI 4.0). |

## Backend

```bash
cd backend
cp ../.env.example ../.env.local     # y rellenar secretos (mínimo 32 chars)
docker-compose -f infrastructure/docker/docker-compose.dev.yml up -d
npm install
npm run dev
```

### Endpoints

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/health` | público (liveness) |
| GET | `/health/ready` | público (comprueba las 3 bases) |
| POST | `/api/v1/auth/login` | público |
| POST | `/api/v1/auth/refresh` | público |
| POST | `/api/v1/auth/register` | rol `admin` |
| POST | `/api/v1/auth/logout` | autenticado |
| GET | `/api/v1/auth/me` | autenticado |
| POST | `/api/v1/auth/mfa/setup` · `mfa/verify` · `mfa/disable` | autenticado |
| GET | `/api/v1/auth/keycloak/me` | token del realm (RS256) |

### Decisiones de seguridad

- **Cerrado por defecto.** `JwtAuthGuard` está registrado como `APP_GUARD`: todo
  endpoint exige token salvo que se marque con `@Public()`. Un controlador nuevo
  nace protegido, no expuesto.
- **Rotación de refresh.** Cada `refresh` revoca el token usado y emite un par
  nuevo; reutilizar el anterior devuelve 401.
- **Revocación real.** El `jti` de los tokens cerrados va a `token_blacklist`, y
  `JwtStrategy` la consulta en cada petición, así que el logout surte efecto de
  inmediato y no al expirar el token.
- **Bloqueo por fuerza bruta.** 5 intentos fallidos bloquean la cuenta 15
  minutos, además del rate limit por IP de `main.ts`.
- **Sin enumeración de cuentas.** Usuario inexistente y contraseña incorrecta
  devuelven el mismo error.
- **Errores opacos.** El cliente recibe un `errorId`; el stack queda en el log.
- **Auditoría con redacción.** El interceptor global nunca escribe contraseñas,
  tokens, RFC, CURP ni CLABE en el log.
- **MFA cifrado.** El secreto TOTP y los códigos de respaldo se guardan cifrados
  con AES-256-GCM; los de respaldo son de un solo uso.

### Verificado en local

Contra PostgreSQL 16 real, con esquema creado por TypeORM: health de las tres
bases, login (correcto, incorrecto y bloqueado), rotación y revocación de
tokens, alta y validación de MFA con TOTP real, RBAC (403 para rol
insuficiente), validación de entrada y round-trip de cifrado con acentos, `ñ` y
emoji.

## Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4.

Los datos son de demostración y viven en el navegador. Para conectar la API hay
que sustituir `lib/store.tsx` por un cliente HTTP con la misma interfaz.

## Despliegue

- **Frontend → Vercel.** Proyecto con *Root Directory* = `frontend`; cada push a
  `main` despliega.
- **Backend → NO va en Vercel.** Necesita procesos de larga vida, Postgres,
  Redis y Keycloak; el destino natural es un host de contenedores (Railway,
  Render, Fly.io, ECS o Kubernetes).

## Documentación

- [`docs/DATABASE-SCHEMA.md`](docs/DATABASE-SCHEMA.md) — las 3 bases, campos
  cifrados e índices críticos.
- [`docs/CLAUDE-CODE-SETUP.md`](docs/CLAUDE-CODE-SETUP.md) — guía de arranque.

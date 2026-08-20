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
| `frontend/` | ✅ Desplegado en Vercel. Las 7 secciones operativas y el administrador oculto de catálogos. Datos demo en `localStorage`: **aún no consume la API**. |
| Autenticación | ✅ Login, JWT con rotación de refresh, revocación, MFA (TOTP), RBAC y cifrado AES-256-GCM. |
| Catálogos | ✅ API completa de los 7 catálogos, con borrado protegido por uso. |
| Servicios | ✅ Alta con folio y carta porte automáticos, edición, monitoreo y cierre financiero (facturar, cobrar, autorizar, pagar, liquidar). |
| Seeds | ✅ `npm run db:seed`, idempotente. |
| Migraciones | ❌ Pendientes. En desarrollo el esquema se crea con `DB_SYNCHRONIZE=true`. |
| Frontend contra API | ❌ Pendiente: sustituir `lib/store.tsx` por un cliente HTTP. |
| Entidades forwarding y monitoreo | ❌ Pendientes. Las conexiones existen y responden, pero sin entidades: proveedores y GPS siguen fuera de la base. |
| Módulo SAT | ⚠️ CFDI 4.0 de traslado con Complemento Carta Porte 3.1: construcción del XML, sellado con el CSD real y timbrado a través de un PAC. Ver las advertencias más abajo antes de usarlo en producción. |

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
| GET | `/api/v1/catalogos/:tipo` | autenticado |
| POST · PATCH · DELETE | `/api/v1/catalogos/:tipo` | `admin`, `manager` |
| GET | `/api/v1/servicios` | autenticado (filtros: `asignacion`, `estado`, `cobro`, `pago`, `liquidacion`, `activos`, `buscar`) |
| GET | `/api/v1/servicios/resumen` | autenticado (cifras del tablero) |
| POST · PATCH | `/api/v1/servicios` | `admin`, `manager`, `dispatcher` |
| POST | `/api/v1/servicios/:id/estado` | `admin`, `manager`, `dispatcher` |
| POST | `/api/v1/servicios/:id/{facturar,cobrar,autorizar-pago,pagar,liquidar}` | `admin`, `manager`, `accountant` |
| POST | `/api/v1/servicios/cxc/marcar-vencidos` | `admin`, `manager`, `accountant` |
| GET | `/api/v1/sat/catalogos` | autenticado |
| GET | `/api/v1/sat/servicios/:id/validar` | autenticado (qué falta para emitir) |
| GET | `/api/v1/sat/servicios/:id/carta-porte[/xml]` | autenticado |
| POST | `/api/v1/sat/servicios/:id/carta-porte/{generar,timbrar,cancelar}` | `admin`, `manager` |

Catálogos válidos en `:tipo`: `clientes`, `unidades`, `operadores`, `puertos`,
`tipos-negocio`, `tipos-unidad`, `tipos-mercancia`.

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
- **Folios sin colisión.** Folio y carta porte se asignan bajo un advisory lock
  de Postgres: ocho altas simultáneas devuelven ocho consecutivos distintos, no
  un choque contra el índice único.
- **Catálogo en uso no se borra.** Se desactiva y responde 409 diciendo cuántos
  servicios lo referencian; borrarlo dejaría servicios apuntando a la nada.
- **Orden del cierre financiero.** No se factura sin completar, no se cobra sin
  factura, no se paga sin autorizar. Liquidar sin que el cliente haya pagado sí
  se permite —es decisión del área— pero queda anotado en la bitácora.

### Verificado en local

Contra PostgreSQL 16 real, con esquema creado por TypeORM:

- **Auth:** health de las tres bases, login (correcto, incorrecto y bloqueado),
  rotación y revocación de tokens, MFA con TOTP real, RBAC, validación de
  entrada y round-trip de cifrado con acentos, `ñ` y emoji.
- **Catálogos:** listado de los siete, alta, borrado real de un registro sin
  uso (204) y protección del que sí se usa (409 + desactivado).
- **Servicios:** seed idempotente, alta FWD full one way con folio y carta
  porte automáticos y crédito heredado del cliente, los siete filtros, el
  resumen del tablero, el ciclo completo de cierre financiero, el barrido de
  vencidos y las reglas que lo ordenan (409 al facturar sin completar, al pagar
  sin autorizar y al liquidar sin completar).
- **Concurrencia:** ocho altas simultáneas → ocho folios únicos, cero fallos.
- **RBAC por endpoint:** un `dispatcher` crea servicios (201) pero no catálogos
  ni facturas (403); sin token, 401.
- **SAT:** con un CSD de prueba generado al vuelo — validación previa listando
  los 14 campos faltantes, captura, emisión del XML con sus ubicaciones,
  autotransporte y figura de transporte, y **verificación criptográfica del
  sello con OpenSSL contra la llave pública del certificado** (`Verified OK`, y
  rechazo al alterar un solo carácter de la cadena). Timbrado simulado con su
  `TimbreFiscalDigital`, cancelación con motivo válido, y los rechazos: re-
  timbrar, re-generar sobre timbrado, motivo inválido y motivo `01` sin UUID
  sustituto. Un `dispatcher` puede validar (200) pero no generar ni timbrar
  (403).

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

## Módulo SAT — Carta Porte

Emite el CFDI 4.0 de tipo Traslado con el Complemento Carta Porte 3.1. El flujo
tiene tres pasos separados a propósito, porque cada uno falla por su cuenta:

1. **Validar** (`/validar`) — dice qué campos faltan, sin emitir nada y sin
   gastar timbre. El PAC cobra el intento y devuelve códigos poco legibles, así
   que conviene llegar limpio.
2. **Generar** — construye el XML y lo sella con el CSD de la empresa.
3. **Timbrar** — lo envía al PAC, que devuelve el UUID fiscal.

La cancelación exige motivo del catálogo del SAT; el motivo `01` («con
relación») pide además el UUID que sustituye al cancelado.

### Advertencias antes de producción

Esto es lo que falta para que los comprobantes tengan validez fiscal:

- **El PAC viene en modo `simulado`.** Devuelve UUID que empiezan con
  `5IMU1AD0` justamente para que sean imposibles de confundir con uno real, y
  la API los marca con `simulado: true`. Timbrar de verdad requiere contratar
  un PAC y configurar `SAT_PAC_DRIVER=http` con sus credenciales. El driver
  `http` habla JSON; casi todos los PAC ofrecen SOAP, así que probablemente
  haya que adaptar `PacService.timbrarHttp` al de su proveedor.
- **La cadena original es una implementación propia.** Sigue la regla del
  Anexo 20 (valores en orden del XSD, sin declaraciones de espacio de nombres,
  separados por `|`), pero la implementación oficial es la transformación XSLT
  que publica el SAT. Antes de emitir en producción hay que contrastar ambas
  con comprobantes reales: si difieren en un carácter, el sello no valida.
- **Los catálogos SAT incluidos son un subconjunto.** `c_ClaveProdServCP` tiene
  más de mil claves; aquí van las de uso diario. Hay que cargar los oficiales
  completos y mantenerlos al día: una clave dada de baja hace que el PAC
  rechace.
- **Solo se emite para servicios TDC.** En FWD el comprobante lo emite el
  transportista que efectivamente traslada, no ADL.
- **No hay representación impresa (PDF).** El complemento la exige para el
  operador que va en carretera.

### Sellado

El CSD se carga una sola vez al arrancar; si no está configurado, el módulo no
se rompe: queda deshabilitado y `/validar` lo reporta. El servicio se niega a
sellar con un certificado vencido, porque el resultado sería un comprobante que
el PAC rechaza. La contraseña de la llave nunca se escribe en el log.

## Documentación

- [`docs/DATABASE-SCHEMA.md`](docs/DATABASE-SCHEMA.md) — las 3 bases, campos
  cifrados e índices críticos.
- [`docs/CLAUDE-CODE-SETUP.md`](docs/CLAUDE-CODE-SETUP.md) — guía de arranque.

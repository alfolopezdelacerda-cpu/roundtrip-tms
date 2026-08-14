# Roundtrip TMS — frontend

Portal operativo en Next.js 16 (App Router), React 19, TypeScript y Tailwind CSS 4.
Es el *Root Directory* del proyecto de Vercel.

```bash
npm install
npm run dev        # http://localhost:3000
```

```
app/          rutas (tablero, viajes, unidades, operadores)
components/   navegación y primitivos de UI
lib/          tipos, datos demo, store en cliente y formateadores
```

Los datos son de demostración y se persisten en `localStorage`. Para conectar la API de
NestJS hay que sustituir `lib/store.tsx` por un cliente HTTP manteniendo la misma interfaz
(`viajes`, `unidades`, `operadores`, `agregarViaje`, `cambiarEstado`).

Documentación general y estado del proyecto: [`../README.md`](../README.md).

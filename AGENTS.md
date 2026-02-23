# AGENTS

Guía rápida para agentes que trabajen en este repo.

## Objetivo
- Proyecto: web de UNKT Estudio (Next.js + Prisma + Tailwind).
- Foco: UX admin prolija en mobile y desktop.
- Entregables: cambios completos (implementar + validar), no solo propuesta.

## Stack
- Node + npm
- Next.js App Router (`src/app`)
- Prisma + SQLite
- Tailwind CSS v4
- TypeScript

## Comandos
- `npm run docker:build`
- `npm run docker:up`
- `npm run docker:logs`
- `npm run docker:down`

## Estructura / rutas clave
- Público:
  - `src/app/page.tsx`
  - `src/components/*` (landing)

- Admin:
  - `/admin` -> panel principal (accesos + carrusel)
  - `/admin/metricas` -> datos + gráficos + histórico
  - `/admin/configuracion` -> usuarios, contenido, precios
  - `/admin/agenda`
  - `/admin/users`
  - `/admin/content`

## Convenciones UI (admin)
- En rutas `/admin*`, usar `BrandMark` con `showText={false}`.
- En subpáginas admin (`users`, `content`, `agenda`, `metricas`, `configuracion`):
  - mantener botón `Volver` junto a `ThemeToggle`.
- Mantener labels y copy en español (rioplatense neutral).
- Si un control se corta en mobile: preferir modal centrado bloqueante antes que popover anclado.
- No sobrecargar `/admin`: features avanzadas van a secciones específicas (ej. `metricas`, `configuracion`).

## Convenciones de código
- TypeScript claro, sin `any` salvo necesidad real y justificada.
- Reusar componentes existentes antes de crear nuevos.
- Mantener el lenguaje visual del proyecto (bordes redondeados, `border-accent`, `bg-white/70`, etc.).
- No agregar dependencias nuevas salvo necesidad fuerte (si se agrega, explicar por qué y alternativa descartada).

## Seguridad / acceso
- Toda página admin debe validar sesión con `getSessionFromCookies()`.
- Si el usuario no es admin:
  - redirigir a `/admin` o `/account` según el contexto existente.

## Validación mínima al terminar
- Ejecutar `npm run docker:build`.
- Si el cambio toca routing / server components / Prisma, levantar con `npm run docker:up` y validar logs con `npm run docker:logs`.
- Si no se pudo correr, explicitarlo al final con motivo (ej. faltan env vars o Docker no disponible).

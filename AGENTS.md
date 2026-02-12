# AGENTS

Guia rapida para agentes que trabajen en este repo.

## Objetivo
- Proyecto: web de UNKT Estudio (Next.js + Prisma + Tailwind).
- Mantener foco en UX admin prolija en mobile y desktop.
- Priorizar cambios completos (no solo propuesta): implementar y validar.

## Stack y comandos
- Node + npm
- Next.js App Router (`src/app`)
- Prisma + SQLite
- Tailwind CSS v4

Comandos utiles:
- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run build`

## Rutas clave
- Publico: `src/app/page.tsx`, `src/components/*` de landing
- Admin:
  - `/admin` -> panel principal (accesos + carrusel)
  - `/admin/metricas` -> vista de datos + graficos + historico
  - `/admin/configuracion` -> usuarios, contenido, precios
  - `/admin/agenda`
  - `/admin/users`
  - `/admin/content`

## Convenciones UI (importante)
- En rutas `/admin*`, usar `BrandMark` con `showText={false}`.
- En subpaginas admin (`users`, `content`, `agenda`, `metricas`, `configuracion`), mantener boton `Volver` junto a `ThemeToggle`.
- Mantener labels y copy en espanol.
- Si un control queda cortado en mobile, preferir modal centrado bloqueante antes que popover anclado.
- Evitar sobrecargar `/admin`: funcionalidades avanzadas en secciones especificas (ej. metricas/configuracion).

## Convenciones de codigo
- Mantener TypeScript claro, sin `any` salvo necesidad real.
- Reusar componentes existentes antes de crear nuevos.
- Seguir clases/utilidades visuales del proyecto (bordes redondeados, `border-accent`, `bg-white/70`, etc.).
- No introducir dependencias nuevas salvo necesidad fuerte.

## Seguridad y acceso
- Toda pagina admin debe validar sesion con `getSessionFromCookies()`.
- Si usuario no es admin: redirigir a `/admin` o `/account` segun contexto existente.

## Validacion minima al terminar
- Correr `eslint` sobre archivos modificados.
- Si no se pudo correr, explicitarlo en la respuesta final.


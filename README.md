# UNKT Estudio Landing

MVP de landing para alquiler de estudio fotográfico.

## Desarrollo

- Instalar dependencias: `npm install`
- Correr en local (webpack estable): `npm run dev`
- Opcional Turbopack: `npm run dev:turbo`
- Lint: `npm run lint`
- Build: `npm run build`

## Dónde cambiar datos

Toda la info editable está centralizada en `src/content/studio.ts`.

## Inicio de sesión (Prisma + SQLite)

- Crear archivo `.env` (o copiar `.env.example`) y definir `DATABASE_URL` y `AUTH_SECRET`
- Generar la base local: `npx prisma migrate dev --name init`
- Levantar el proyecto: `npm run dev`
- Registro: `http://localhost:3000/register`
- Iniciar sesión: `http://localhost:3000/login`
- Panel: `http://localhost:3000/admin`
- Editar contenido: `http://localhost:3000/admin/content`

## Checklist de placeholders

- Teléfono de WhatsApp en formato E.164 sin `+`
- Dirección real y link de Google Maps
- Horarios reales
- URL de sitio (`siteUrl`)
- Reemplazar imágenes placeholder en `public/`

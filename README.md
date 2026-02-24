# UNKT Estudio Landing

MVP de landing para alquiler de estudio fotográfico.

## Operacion (Docker)

1. Deja configurado `.env` con al menos:
   - `AUTH_SECRET`
   - `DATABASE_URL=file:../database/prod.db`
2. Construir imagen: `npm run docker:build`
3. Levantar en segundo plano: `npm run docker:up`
4. Rebuild + restart: `npm run docker:rebuild`
5. Ver logs: `npm run docker:logs`
6. Bajar servicios: `npm run docker:down`

Notas:
- El contenedor corre en `http://localhost:3000`.
- `DATABASE_URL` se toma desde `.env` (recomendado `file:../database/prod.db`).
- La carpeta `database/` queda persistida en el volumen `unkt_database`.
- Al iniciar, se ejecuta `prisma migrate deploy` antes de levantar Next.js.

## Dónde cambiar datos

Toda la info editable está centralizada en `src/content/studio.ts`.

## Inicio de sesión (Prisma + SQLite)

- Crear archivo `.env` y definir `AUTH_SECRET` y `DATABASE_URL=file:../database/prod.db`
- Levantar con Docker: `npm run docker:up`
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

## Recuperacion de contrasena (SES SMTP)

- Provider: `PASSWORD_RESET_EMAIL_PROVIDER=smtp|disabled|manual`
- SMTP SES: `SES_SMTP_HOST`, `SES_SMTP_PORT` (recomendado `587`), `SES_SMTP_USER`, `SES_SMTP_PASS`
- Remitente: `PASSWORD_RESET_FROM_EMAIL`
- Opcional: `PASSWORD_RESET_REPLY_TO_EMAIL`

Comportamiento:
- `smtp`: envia correo real por SMTP.
- `disabled`: no envia correo y devuelve mensaje claro al usuario.
- `manual`: no envia correo y dirige a restablecimiento manual por soporte.
- Desarrollo sin provider/config: no rompe el flujo; loguea el enlace en consola.

## Mantenimiento de reservas vencidas (cron)

- Endpoint: `GET` o `POST /api/internal/maintenance/prune-expired-bookings`
- Auth: header `Authorization: Bearer <MAINTENANCE_CRON_SECRET>`
- En desarrollo, si no hay secreto configurado, el endpoint permite ejecucion local.

Ejemplo manual:

```bash
curl -X POST "http://localhost:3000/api/internal/maintenance/prune-expired-bookings" \
  -H "Authorization: Bearer tu-secreto"
```

Recomendacion:

- Configura un cron cada 5-15 minutos en tu proveedor (Vercel Cron u otro) apuntando al endpoint.
- Define `MAINTENANCE_CRON_SECRET` en el entorno donde se ejecute.

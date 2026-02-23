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

## Mercado Pago Checkout Bricks

Integracion actual:

- Checkout embebido con `Payment Brick` en `/checkout?bookingId=<id>`.
- Estado de pago con `Status Screen Brick` en `/checkout/estado?payment_id=<id>`.
- Preferencias creadas en backend por `POST /api/mp/preference`.
- Webhook en `POST /api/mp/webhook` (consulta API de MP antes de marcar pago).
- Persistencia en Prisma con modelo `Payment`.

Variables de entorno necesarias:

- `MERCADOPAGO_ACCESS_TOKEN` (solo server, TEST o PROD segun ambiente).
- `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` (solo client, TEST o PROD segun ambiente).
- `MERCADOPAGO_TEST_PAYER_EMAIL` (opcional, recomendado para pruebas con comprador test).
- `MERCADOPAGO_WEBHOOK_SECRET` (opcional, reservado para validacion de firma).

### Pruebas en TEST (sandbox)

- Usa `MERCADOPAGO_ACCESS_TOKEN` de una cuenta **Vendedor** de prueba.
- Usa `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` de la misma cuenta TEST.
- Crea una cuenta **Comprador** de prueba en el mismo pais.
- Si reservas como invitado (`guest-...@guest.unk`), define `MERCADOPAGO_TEST_PAYER_EMAIL`.
- Flujo sugerido:
  - Crear reserva en `/reservar`.
  - Ir al checkout embebido (`/checkout?bookingId=...`).
  - Completar pago de prueba.
  - Ver resultado en `/checkout/estado?payment_id=...`.

Nota: en algunos pagos Mercado Pago puede abrir un challenge 3DS del banco (redireccion temporal inevitable).

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

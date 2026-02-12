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

## Pruebas con cuentas de Mercado Pago

Para probar el flujo completo de pago con usuarios de prueba:

- Usa `MERCADOPAGO_ACCESS_TOKEN` de una cuenta **Vendedor** de prueba.
- Crea una cuenta **Comprador** de prueba en el mismo pais.
- Configura `MERCADOPAGO_TEST_PAYER_EMAIL` con el email del comprador test.
- Si necesitas forzar checkout sandbox con credenciales productivas, activa `MERCADOPAGO_PREFER_SANDBOX_INIT_POINT=true`.

Nota: si la reserva se genera como invitado, el sistema usa un email interno `guest-...@guest.unk`. Con access token `TEST-...`, debes configurar `MERCADOPAGO_TEST_PAYER_EMAIL` para poder iniciar el checkout.

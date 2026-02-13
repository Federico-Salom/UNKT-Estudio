import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  dedupeExtras,
  getExtraPrice,
  resolveBasePrice,
  resolveExtraMaxSelections,
  resolveExtrasFromLabels,
} from "@/lib/booking";
import {
  getServicesSummaryLines,
  parseStoredServicesSelection,
} from "@/lib/services";
import { getStudioContent } from "@/lib/studio-content";

export const runtime = "nodejs";

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ ok: false, error: message }, { status });

const getBaseUrl = (request: NextRequest) => {
  const parsed = new URL(request.url);
  const host = request.headers.get("host") || parsed.host;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isLocal = host.includes("localhost") || host.startsWith("127.0.0.1");
  const protocol = isLocal
    ? "http"
    : forwardedProto || parsed.protocol.replace(":", "");
  return `${protocol}://${host}`;
};

const parseBooleanEnv = (value?: string) =>
  typeof value === "string" &&
  ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());

const isTestAccessToken = (token: string) => token.trim().startsWith("TEST-");

const getAccessToken = () => {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN no está configurado.");
  }
  return token.trim();
};

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return errorResponse("Inicia sesión para pagar.", 401);
  }

  const body = await request.json().catch(() => ({}));
  const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";

  if (!bookingId) {
    return errorResponse("Reserva inválida.");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { user: true },
  });

  if (!booking) {
    return errorResponse("Reserva no encontrada.", 404);
  }

  const isOwner = booking.userId === session.userId;
  const isAdmin = session.role === "admin";
  if (!isOwner && !isAdmin) {
    return errorResponse("No autorizado.", 403);
  }

  if (booking.status === "paid") {
    return errorResponse("Esta reserva ya está pagada.", 409);
  }
  const accessToken = getAccessToken();
  const hasTestAccessToken = isTestAccessToken(accessToken);

  const extras = (() => {
    try {
      return dedupeExtras(JSON.parse(booking.extras || "[]") as string[]);
    } catch {
      return [];
    }
  })();
  const hours = booking.hours
    ? booking.hours
    : (() => {
        try {
          const ids = JSON.parse(booking.slotIds || "[]") as string[];
          return ids.length || 1;
        } catch {
          return 1;
        }
      })();
  const studio = await getStudioContent();
  const basePrice = resolveBasePrice(studio.pricing.basePrice);
  const resolvedExtras = resolveExtrasFromLabels(
    extras,
    studio.extras.backgrounds,
    resolveExtraMaxSelections(studio.extras.maxSelections)
  );
  const breakdownExtras =
    resolvedExtras.length === extras.length
      ? resolvedExtras.map((extra) => ({
          title: `Extra: ${extra.label}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: extra.price,
        }))
      : extras.map((extra) => ({
          title: `Extra: ${extra}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: getExtraPrice(extra, studio.extras.backgrounds),
        }));
  const servicesSelection = parseStoredServicesSelection(
    booking.services || "[]",
    studio.services
  );
  const breakdownServices = getServicesSummaryLines({
    selection: servicesSelection,
    catalog: studio.services,
    hours,
  }).map((service) => ({
    title: `Servicio: ${service.label}`,
    quantity: 1,
    currency_id: "ARS",
    unit_price: service.amount,
  }));

  const baseUrl = process.env.APP_URL || getBaseUrl(request);
  const breakdownItems = [
    {
      title: "Reserva UNKT Estudio (hora)",
      quantity: hours,
      currency_id: "ARS",
      unit_price: basePrice,
    },
    ...breakdownExtras,
    ...breakdownServices,
  ];
  const breakdownTotal = breakdownItems.reduce(
    (total, item) => total + item.quantity * item.unit_price,
    0
  );
  const paymentItems =
    breakdownTotal === booking.total
      ? breakdownItems
      : [
          {
            title: "Reserva UNKT Estudio",
            quantity: 1,
            currency_id: "ARS",
            unit_price: booking.total,
          },
        ];

  const bookingEmail = booking.email.trim().toLowerCase();
  const configuredTestBuyerEmail =
    process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim().toLowerCase() || "";
  const isGeneratedGuestEmail = bookingEmail.endsWith("@guest.unk");
  const payerEmail = configuredTestBuyerEmail || bookingEmail;

  if (hasTestAccessToken && isGeneratedGuestEmail && !configuredTestBuyerEmail) {
    return errorResponse(
      "Configura MERCADOPAGO_TEST_PAYER_EMAIL con el email del comprador de prueba para continuar.",
      400
    );
  }

  const preferencePayload = {
    items: paymentItems,
    payer: {
      email: payerEmail,
      name: booking.name,
    },
    external_reference: booking.id,
    back_urls: {
      success: `${baseUrl}/pago/${booking.id}?status=success`,
      failure: `${baseUrl}/pago/${booking.id}?status=failure`,
      pending: `${baseUrl}/pago/${booking.id}?status=pending`,
    },
    auto_return: "approved",
    notification_url: `${baseUrl}/api/payments/mercadopago/webhook`,
  };

  const response = await fetch(
    "https://api.mercadopago.com/checkout/preferences",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferencePayload),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return errorResponse(
      data.message || "No se pudo iniciar el pago con Mercado Pago.",
      response.status || 500
    );
  }

  const preferSandboxInitPoint = parseBooleanEnv(
    process.env.MERCADOPAGO_PREFER_SANDBOX_INIT_POINT
  );
  const checkoutUrl = preferSandboxInitPoint
    ? data.sandbox_init_point || data.init_point
    : data.init_point || data.sandbox_init_point;

  if (!checkoutUrl) {
    return errorResponse("Mercado Pago no devolvió una URL de checkout.", 502);
  }

  return NextResponse.json({
    ok: true,
    checkoutUrl,
    initPoint: data.init_point,
    sandboxInitPoint: data.sandbox_init_point,
    preferenceId: data.id,
  });
}

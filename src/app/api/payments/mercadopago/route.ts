import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dedupeExtras, getExtraPrice, resolveBasePrice } from "@/lib/booking";
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

const getAccessToken = () => {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN no está configurado.");
  }
  return token;
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

  const baseUrl = process.env.APP_URL || getBaseUrl(request);
  const breakdownItems = [
    {
      title: "Reserva UNKT Estudio (hora)",
      quantity: hours,
      currency_id: "ARS",
      unit_price: basePrice,
    },
    ...extras.map((extra) => ({
      title: `Extra: ${extra}`,
      quantity: 1,
      currency_id: "ARS",
      unit_price: getExtraPrice(extra),
    })),
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

  const preferencePayload = {
    items: paymentItems,
    payer: {
      email: booking.email,
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
        Authorization: `Bearer ${getAccessToken()}`,
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

  return NextResponse.json({
    ok: true,
    initPoint: data.init_point,
    sandboxInitPoint: data.sandbox_init_point,
    preferenceId: data.id,
  });
}

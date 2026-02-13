import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { pruneExpiredPendingBookings } from "@/lib/booking-expiration";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type PreferenceBody = {
  amount?: number;
  title?: string;
  payerEmail?: string;
  externalReference?: string;
};

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ ok: false, error: message }, { status });

const getAccessToken = () => {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN no esta configurado.");
  }
  return token;
};

const isTestAccessToken = (token: string) => token.startsWith("TEST-");

const normalizeString = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value).trim();
  return "";
};

const parseAmount = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return Number.NaN;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return errorResponse("Inicia sesion para continuar.", 401);
  }

  await pruneExpiredPendingBookings();

  const body = (await request.json().catch(() => ({}))) as PreferenceBody;
  const amount = parseAmount(body.amount);
  const title = normalizeString(body.title);
  const providedPayerEmail = normalizeEmail(normalizeString(body.payerEmail));
  const externalReference = normalizeString(body.externalReference);

  if (!Number.isFinite(amount) || amount <= 0) {
    return errorResponse("El monto es invalido.");
  }

  if (!title) {
    return errorResponse("El titulo es obligatorio.");
  }

  if (title.length > 120) {
    return errorResponse("El titulo no puede superar 120 caracteres.");
  }

  if (providedPayerEmail && !isValidEmail(providedPayerEmail)) {
    return errorResponse("El email del pagador es invalido.");
  }

  let normalizedPayerEmail = providedPayerEmail;
  let normalizedExternalReference = externalReference || null;
  const integerAmount = Math.round(amount);

  if (externalReference) {
    const booking = await prisma.booking.findUnique({
      where: { id: externalReference },
      select: {
        id: true,
        userId: true,
        status: true,
        total: true,
        email: true,
      },
    });

    if (booking) {
      const isOwner = booking.userId === session.userId;
      const isAdmin = session.role === "admin";

      if (!isOwner && !isAdmin) {
        return errorResponse("No autorizado para pagar esta reserva.", 403);
      }

      if (booking.status === "paid") {
        return errorResponse("Esta reserva ya esta pagada.", 409);
      }

      if (booking.total !== integerAmount) {
        return errorResponse(
          "El monto no coincide con el total de la reserva.",
          400
        );
      }

      if (!normalizedPayerEmail) {
        normalizedPayerEmail = normalizeEmail(booking.email);
      }

      normalizedExternalReference = booking.id;
    }
  }

  if (normalizedPayerEmail && !isValidEmail(normalizedPayerEmail)) {
    return errorResponse("El email del pagador es invalido.");
  }

  const accessToken = getAccessToken();
  const hasTestAccessToken = isTestAccessToken(accessToken);
  const configuredTestBuyerEmail =
    process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim().toLowerCase() || "";
  const payerEmail = configuredTestBuyerEmail || normalizedPayerEmail;

  if (
    hasTestAccessToken &&
    normalizedPayerEmail.endsWith("@guest.unk") &&
    !configuredTestBuyerEmail
  ) {
    return errorResponse(
      "Configura MERCADOPAGO_TEST_PAYER_EMAIL para pagos de prueba con cuenta invitada."
    );
  }

  const payment = await prisma.payment.create({
    data: {
      amount: integerAmount,
      title,
      payerEmail: payerEmail || null,
      externalReference: normalizedExternalReference,
      status: "pending",
    },
    select: {
      id: true,
    },
  });

  const baseUrl = process.env.APP_URL?.trim() || getBaseUrl(request);
  const payload = {
    items: [
      {
        title,
        quantity: 1,
        currency_id: "ARS",
        unit_price: integerAmount,
      },
    ],
    external_reference: payment.id,
    payer: payerEmail ? { email: payerEmail } : undefined,
    metadata: normalizedExternalReference
      ? { external_reference: normalizedExternalReference }
      : undefined,
    back_urls: {
      success: `${baseUrl}/checkout/estado`,
      failure: `${baseUrl}/checkout/estado`,
      pending: `${baseUrl}/checkout/estado`,
    },
    auto_return: "approved",
    notification_url: `${baseUrl}/api/mp/webhook`,
  };

  const mpResponse = await fetch(
    "https://api.mercadopago.com/checkout/preferences",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const mpData = await mpResponse.json().catch(() => ({}));
  if (!mpResponse.ok || typeof mpData.id !== "string") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "rejected",
      },
    });

    return errorResponse(
      mpData?.message || "No se pudo crear la preferencia de pago.",
      mpResponse.status || 502
    );
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      mpPreferenceId: mpData.id,
      status: "pending",
    },
  });

  return NextResponse.json({
    ok: true,
    preferenceId: mpData.id,
    paymentId: payment.id,
  });
}

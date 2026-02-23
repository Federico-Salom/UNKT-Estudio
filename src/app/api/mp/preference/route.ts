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

const DEFAULT_MERCADOPAGO_TEST_PAYER_EMAIL = "test@testuser.com";
const REUSABLE_PENDING_PAYMENT_WINDOW_MS = 10 * 60 * 1000;

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ ok: false, error: message }, { status });

const getAccessToken = () => {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN no está configurado.");
  }
  return token;
};

const isTestAccessToken = (token: string) => token.startsWith("TEST-");
const isTestPublicKey = (publicKey: string) => publicKey.startsWith("TEST-");

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
const normalizeTestPayerEmailInput = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";

  const usernameMatch =
    normalized.match(/^testuser(\d+)$/i) ||
    normalized.match(/^test_user_(\d+)$/i);
  if (usernameMatch?.[1]) {
    return `test_user_${usernameMatch[1]}@testuser.com`;
  }

  const emailMatch =
    normalized.match(/^testuser(\d+)@testuser\.com$/i) ||
    normalized.match(/^test_user_(\d+)@testuser\.com$/i);
  if (emailMatch?.[1]) {
    return `test_user_${emailMatch[1]}@testuser.com`;
  }

  return normalized;
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isLikelyMercadoPagoTestEmail = (value: string) => {
  const email = value.trim().toLowerCase();
  return email.endsWith("@testuser.com") || email.includes("test_user_");
};

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
    return errorResponse("El monto es inválido.");
  }

  if (!title) {
    return errorResponse("El titulo es obligatorio.");
  }

  if (title.length > 120) {
    return errorResponse("El titulo no puede superar 120 caracteres.");
  }

  if (providedPayerEmail && !isValidEmail(providedPayerEmail)) {
    return errorResponse("El email del pagador es inválido.");
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
        return errorResponse("Esta reserva ya está pagada.", 409);
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
    return errorResponse("El email del pagador es inválido.");
  }

  const accessToken = getAccessToken();
  const hasTestAccessToken = isTestAccessToken(accessToken);
  const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() || "";
  const hasTestPublicKey = isTestPublicKey(publicKey);

  if (Boolean(publicKey) && hasTestAccessToken !== hasTestPublicKey) {
    return errorResponse(
      "Las credenciales de Mercado Pago estan mezcladas entre TEST y PROD. Revisa MERCADOPAGO_ACCESS_TOKEN y NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY."
    );
  }

  const configuredTestBuyerEmail =
    normalizeTestPayerEmailInput(
      process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim() || ""
    );
  let payerEmail = configuredTestBuyerEmail || normalizedPayerEmail;

  if (hasTestAccessToken && configuredTestBuyerEmail) {
    if (!isValidEmail(configuredTestBuyerEmail)) {
      return errorResponse(
        "MERCADOPAGO_TEST_PAYER_EMAIL no es valido. Usa un email de prueba, por ejemplo test@testuser.com."
      );
    }

    if (!isLikelyMercadoPagoTestEmail(configuredTestBuyerEmail)) {
      return errorResponse(
        "MERCADOPAGO_TEST_PAYER_EMAIL debe ser de prueba (@testuser.com)."
      );
    }
  }
  if (hasTestAccessToken && !configuredTestBuyerEmail) {
    payerEmail = DEFAULT_MERCADOPAGO_TEST_PAYER_EMAIL;
  }

  if (
    hasTestAccessToken &&
    payerEmail &&
    !isLikelyMercadoPagoTestEmail(payerEmail)
  ) {
    return errorResponse(
      "Con credenciales TEST de Mercado Pago debes pagar con un comprador de prueba (test_user_...@testuser.com)."
    );
  }

  if (normalizedExternalReference) {
    const reusableSince = new Date(
      Date.now() - REUSABLE_PENDING_PAYMENT_WINDOW_MS
    );
    const reusablePayment = await prisma.payment.findFirst({
      where: {
        externalReference: normalizedExternalReference,
        amount: integerAmount,
        title,
        status: "pending",
        mpPreferenceId: { not: null },
        createdAt: { gte: reusableSince },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        mpPreferenceId: true,
        payerEmail: true,
      },
    });

    if (reusablePayment?.mpPreferenceId) {
      return NextResponse.json({
        ok: true,
        preferenceId: reusablePayment.mpPreferenceId,
        paymentId: reusablePayment.id,
        payerEmail: reusablePayment.payerEmail || null,
      });
    }
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
    payerEmail: payerEmail || null,
  });
}

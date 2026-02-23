import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ProcessPaymentBody = {
  paymentId?: string;
  formData?: Record<string, unknown>;
};

const DEFAULT_MERCADOPAGO_TEST_PAYER_EMAIL = "test@testuser.com";
const VALID_PAYER_ENTITY_TYPES = new Set(["individual", "association"]);

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

const isLikelyMercadoPagoTestEmail = (value: string) => {
  const email = value.trim().toLowerCase();
  return email.endsWith("@testuser.com") || email.includes("test_user_");
};

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

const getConfiguredTestPayerEmail = () =>
  normalizeTestPayerEmailInput(
    process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim() || ""
  ) ||
  DEFAULT_MERCADOPAGO_TEST_PAYER_EMAIL;

const normalizeString = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value).trim();
  return "";
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const sanitizePayer = (payer: Record<string, unknown> | null) => {
  if (!payer) return null;

  const sanitizedPayer: Record<string, unknown> = { ...payer };
  const entityTypeValue = normalizeString(
    sanitizedPayer.entity_type ?? sanitizedPayer.entityType
  ).toLowerCase();

  if (entityTypeValue) {
    if (VALID_PAYER_ENTITY_TYPES.has(entityTypeValue)) {
      sanitizedPayer.entity_type = entityTypeValue;
    } else {
      delete sanitizedPayer.entity_type;
      delete sanitizedPayer.entityType;
    }
  } else {
    delete sanitizedPayer.entity_type;
    delete sanitizedPayer.entityType;
  }

  return sanitizedPayer;
};

const getMpErrorMessage = (mpData: Record<string, unknown>) => {
  const message =
    normalizeString(mpData.message) ||
    normalizeString(mpData.error) ||
    "No se pudo procesar el pago.";

  const cause = Array.isArray(mpData.cause)
    ? mpData.cause
        .map((item) => {
          const causeRecord = asRecord(item);
          if (!causeRecord) return "";
          const description = normalizeString(causeRecord.description);
          const code = normalizeString(causeRecord.code);
          if (!description && !code) return "";
          return code ? `${description} (${code})` : description;
        })
        .filter(Boolean)
        .join(" | ")
    : "";

  return cause ? `${message} ${cause}` : message;
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

  const body = (await request.json().catch(() => ({}))) as ProcessPaymentBody;
  const localPaymentId = normalizeString(body.paymentId);
  const formData = asRecord(body.formData);

  if (!localPaymentId) {
    return errorResponse("Falta el id de pago local.");
  }

  if (!formData) {
    return errorResponse("Faltan los datos del formulario de pago.");
  }

  const localPayment = await prisma.payment.findUnique({
    where: { id: localPaymentId },
    select: {
      id: true,
      amount: true,
      payerEmail: true,
      externalReference: true,
    },
  });

  if (!localPayment) {
    return errorResponse("No encontramos el pago a procesar.", 404);
  }

  let bookingId: string | null = null;
  if (localPayment.externalReference) {
    const booking = await prisma.booking.findUnique({
      where: { id: localPayment.externalReference },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (booking) {
      const isOwner = booking.userId === session.userId;
      const isAdmin = session.role === "admin";

      if (!isOwner && !isAdmin) {
        return errorResponse("No autorizado para pagar esta reserva.", 403);
      }

      if (booking.status === "paid") {
        return errorResponse("Esta reserva ya figura como pagada.", 409);
      }

      bookingId = booking.id;
    }
  }

  const accessToken = getAccessToken();
  const hasTestAccessToken = isTestAccessToken(accessToken);
  const baseUrl = process.env.APP_URL?.trim() || getBaseUrl(request);
  const existingMetadata = asRecord(formData.metadata) || {};
  const incomingPayer = sanitizePayer(asRecord(formData.payer));
  const incomingPayerEmail = normalizeString(incomingPayer?.email).toLowerCase();
  const storedPayerEmail = normalizeString(localPayment.payerEmail).toLowerCase();

  const payload: Record<string, unknown> = {
    ...formData,
    transaction_amount: localPayment.amount,
    external_reference: localPayment.id,
    notification_url: `${baseUrl}/api/mp/webhook`,
    metadata: bookingId
      ? { ...existingMetadata, external_reference: bookingId }
      : existingMetadata,
  };

  if ("entity_type" in payload || "entityType" in payload) {
    delete payload.entity_type;
    delete payload.entityType;
  }

  if (hasTestAccessToken) {
    const effectivePayerEmail =
      storedPayerEmail || incomingPayerEmail || getConfiguredTestPayerEmail();

    if (!effectivePayerEmail || !isLikelyMercadoPagoTestEmail(effectivePayerEmail)) {
      return errorResponse(
        "Con credenciales TEST de Mercado Pago debes pagar con un email de prueba (@testuser.com), por ejemplo test@testuser.com."
      );
    }

    payload.payer = {
      ...(incomingPayer || {}),
      email: effectivePayerEmail,
    };
  } else if (!payload.payer && localPayment.payerEmail) {
    payload.payer = { email: localPayment.payerEmail };
  }

  const requestPayment = async (
    paymentPayload: Record<string, unknown>
  ): Promise<{ response: Response; data: Record<string, unknown> }> => {
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify(paymentPayload),
    });

    const data = (await response
      .json()
      .catch(() => ({}))) as Record<string, unknown>;

    return { response, data };
  };

  let { response: mpResponse, data: mpData } = await requestPayment(payload);
  let mpPaymentId = normalizeString(mpData.id);
  let status = normalizeString(mpData.status) || "pending";

  const normalizedMpMessage = normalizeString(mpData.message).toLowerCase();
  if (
    !mpResponse.ok &&
    normalizedMpMessage.includes("entitytype") &&
    asRecord(payload.payer)
  ) {
    const retryPayload = { ...payload };
    const retryPayer = sanitizePayer(asRecord(retryPayload.payer));
    if (retryPayer) {
      delete retryPayer.entity_type;
      retryPayload.payer = retryPayer;
    }

    const retryResult = await requestPayment(retryPayload);
    mpResponse = retryResult.response;
    mpData = retryResult.data;
    mpPaymentId = normalizeString(mpData.id);
    status = normalizeString(mpData.status) || "pending";
  }

  if (!mpResponse.ok || !mpPaymentId) {
    await prisma.payment.updateMany({
      where: { id: localPayment.id },
      data: { status: "rejected" },
    });

    return errorResponse(
      getMpErrorMessage(mpData),
      mpResponse.status || 502
    );
  }

  await prisma.payment.update({
    where: { id: localPayment.id },
    data: {
      mpPaymentId,
      status,
    },
  });

  if (bookingId && status === "approved") {
    await prisma.booking.updateMany({
      where: { id: bookingId },
      data: { status: "paid" },
    });
  }

  return NextResponse.json({
    ok: true,
    paymentId: mpPaymentId,
    status,
  });
}

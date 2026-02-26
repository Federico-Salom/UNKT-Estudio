import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Order, PaymentMethod } from "mercadopago";
import { getSessionFromCookies } from "@/lib/auth";
import { pruneExpiredPendingBookings } from "@/lib/booking-expiration";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type CreateOrderBody = {
  bookingId?: string;
  formData?: Record<string, unknown>;
  additionalData?: Record<string, unknown>;
};

const PENDING_STATUSES = new Set([
  "pending",
  "in_process",
  "authorized",
  "action_required",
  "processing",
]);

const normalizeString = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value).trim();
  return "";
};

const normalizeInteger = (value: unknown) => {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.trunc(numeric);
  return rounded > 0 ? rounded : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const parseHttpStatus = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return null;
  if (numeric < 400 || numeric > 599) return null;
  return numeric;
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

const isGuestEmail = (value: string) =>
  value.trim().toLowerCase().endsWith("@guest.unk");

const isApproved = ({
  orderStatus,
  orderStatusDetail,
  paymentStatus,
  paymentStatusDetail,
}: {
  orderStatus: string;
  orderStatusDetail: string;
  paymentStatus: string;
  paymentStatusDetail: string;
}) =>
  paymentStatus === "approved" ||
  paymentStatusDetail === "accredited" ||
  orderStatusDetail === "accredited" ||
  (orderStatus === "processed" && paymentStatus === "approved");

const isPending = ({
  orderStatus,
  orderStatusDetail,
  paymentStatus,
  paymentStatusDetail,
}: {
  orderStatus: string;
  orderStatusDetail: string;
  paymentStatus: string;
  paymentStatusDetail: string;
}) =>
  PENDING_STATUSES.has(orderStatus) ||
  PENDING_STATUSES.has(orderStatusDetail) ||
  PENDING_STATUSES.has(paymentStatus) ||
  PENDING_STATUSES.has(paymentStatusDetail);

const formatMercadoPagoError = (error: unknown) => {
  const parsed = asRecord(error);
  if (!parsed) {
    return {
      message: "No se pudo procesar el pago con Mercado Pago.",
      status: 502,
    };
  }

  const dataRecord = asRecord(parsed.data);
  const transactionsRecord = asRecord(dataRecord?.transactions);
  const firstPayment = Array.isArray(transactionsRecord?.payments)
    ? asRecord(transactionsRecord?.payments[0])
    : null;
  const paymentStatusDetail = normalizeString(firstPayment?.status_detail).toLowerCase();

  const errorsList = Array.isArray(parsed.errors)
    ? parsed.errors
        .map((item) => {
          const errorItem = asRecord(item);
          if (!errorItem) return "";
          const code = normalizeString(errorItem.code);
          const message = normalizeString(errorItem.message);
          if (!code && !message) return "";
          return code ? `${message} (${code})` : message;
        })
        .filter(Boolean)
    : [];

  const hasInvalidCredentials = errorsList.some((item) =>
    item.toLowerCase().includes("invalid_credentials")
  );
  if (hasInvalidCredentials) {
    return {
      message:
        "Checkout API Orders no acepta credenciales TEST. Usa MERCADOPAGO_ACCESS_TOKEN de produccion (APP_USR-...) y usuarios/tarjetas de prueba para sandbox.",
      status: 400,
    };
  }

  if (paymentStatusDetail) {
    const knownDetailMessages: Record<string, string> = {
      rejected_by_issuer:
        "Pago rechazado por el emisor de la tarjeta de prueba. Prueba con una tarjeta test valida y titular APRO para simular aprobacion.",
      invalid_security_code:
        "Codigo de seguridad invalido. Verifica el CVV de la tarjeta de prueba.",
      expired_card:
        "La tarjeta esta vencida. Usa una fecha futura para la prueba.",
      insufficient_amount:
        "Fondos insuficientes en la simulacion de la tarjeta de prueba.",
      rejected_high_risk:
        "Pago rechazado por validacion de riesgo.",
      pending_contingency:
        "Pago en revision. Mercado Pago lo mantiene pendiente por contingencia.",
    };
    const mappedMessage = knownDetailMessages[paymentStatusDetail];
    if (mappedMessage) {
      return {
        message: mappedMessage,
        status: 400,
      };
    }
  }

  const baseMessage =
    normalizeString(parsed.message) ||
    normalizeString(parsed.error) ||
    errorsList.join(" | ") ||
    "No se pudo procesar el pago con Mercado Pago.";

  const cause = Array.isArray(parsed.cause)
    ? parsed.cause
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

  return {
    message: cause ? `${baseMessage} ${cause}` : baseMessage,
    status:
      parseHttpStatus(parsed.status ?? asRecord(parsed.api_response)?.status) ??
      (errorsList.length ? 400 : 502),
  };
};

const resolvePaymentMethodType = async (
  client: MercadoPagoConfig,
  paymentMethodId: string
) => {
  if (!paymentMethodId) return "";

  const paymentMethodClient = new PaymentMethod(client);
  const methods = await paymentMethodClient.get();
  const method = methods.find(
    (item) => normalizeString(item.id).toLowerCase() === paymentMethodId
  );
  return normalizeString(method?.payment_type_id).toLowerCase();
};

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return errorResponse("Inicia sesion para continuar.", 401);
  }

  await pruneExpiredPendingBookings();

  const body = (await request.json().catch(() => ({}))) as CreateOrderBody;
  const bookingId = normalizeString(body.bookingId);
  const formData = asRecord(body.formData);
  const additionalData = asRecord(body.additionalData);

  if (!bookingId) {
    return errorResponse("Falta el id de la reserva.");
  }

  if (!formData) {
    return errorResponse("Faltan los datos de la tarjeta.");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      status: true,
      total: true,
      email: true,
    },
  });

  if (!booking) {
    return errorResponse("Reserva no encontrada.", 404);
  }

  const isOwner = booking.userId === session.userId;
  const isAdmin = session.role === "admin";
  if (!isOwner && !isAdmin) {
    return errorResponse("No autorizado para pagar esta reserva.", 403);
  }

  if (booking.status === "paid") {
    return errorResponse("Esta reserva ya figura como pagada.", 409);
  }

  const token = normalizeString(formData.token);
  const paymentMethodId = normalizeString(formData.payment_method_id).toLowerCase();
  const installments = normalizeInteger(formData.installments);
  const payerData = asRecord(formData.payer);
  const payerIdentification = asRecord(payerData?.identification);

  if (!token) {
    return errorResponse(
      "No pudimos generar el token de tarjeta. Recarga el checkout y prueba otra vez.",
      400
    );
  }

  if (!paymentMethodId) {
    return errorResponse(
      "No pudimos identificar la tarjeta. Recarga el checkout y prueba otra vez.",
      400
    );
  }

  if (!installments) {
    return errorResponse("No pudimos validar las cuotas seleccionadas.", 400);
  }

  const accessToken = getAccessToken();
  const client = new MercadoPagoConfig({
    accessToken,
    options: {
      timeout: 10000,
    },
  });

  let paymentMethodType =
    normalizeString(additionalData?.paymentTypeId).toLowerCase() ||
    normalizeString(formData.payment_type_id).toLowerCase();

  if (!paymentMethodType) {
    try {
      paymentMethodType = await resolvePaymentMethodType(client, paymentMethodId);
    } catch {
      paymentMethodType = "";
    }
  }

  if (isTestAccessToken(accessToken)) {
    return errorResponse(
      "Checkout API Orders no acepta credenciales TEST. Usa MERCADOPAGO_ACCESS_TOKEN de produccion (APP_USR-...) y usuarios/tarjetas de prueba para sandbox.",
      400
    );
  }

  const configuredTestPayerEmail = normalizeTestPayerEmailInput(
    process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim() || ""
  );
  const bookingEmail = normalizeString(booking.email).toLowerCase();
  const formPayerEmail = normalizeString(payerData?.email).toLowerCase();

  let payerEmail = configuredTestPayerEmail || formPayerEmail || bookingEmail;
  if (!payerEmail || isGuestEmail(payerEmail)) {
    payerEmail = `checkout.${booking.id.slice(0, 12)}@example.com`;
  }

  if (!payerEmail) {
    return errorResponse("No se pudo resolver el email del pagador.");
  }

  const identificationType = normalizeString(payerIdentification?.type).toUpperCase();
  const identificationNumber = normalizeString(
    payerIdentification?.number
  ).replace(/\D/g, "");

  const amount = booking.total.toFixed(2);
  const orderClient = new Order(client);
  const paymentMethod: Record<string, unknown> = {
    id: paymentMethodId,
    token,
    installments,
  };

  if (paymentMethodType) {
    paymentMethod.type = paymentMethodType;
  }

  const payload: Record<string, unknown> = {
    type: "online",
    processing_mode: "automatic",
    currency: "ARS",
    external_reference: booking.id,
    total_amount: amount,
    description: "Reserva UNKT Estudio",
    payer: {
      email: payerEmail,
      identification:
        identificationType && identificationNumber
          ? {
              type: identificationType,
              number: identificationNumber,
            }
          : undefined,
    },
    transactions: {
      payments: [
        {
          amount,
          payment_method: paymentMethod,
        },
      ],
    },
  };

  try {
    const order = await orderClient.create({
      body: payload,
      requestOptions: {
        idempotencyKey: randomUUID(),
      },
    });

    const firstPayment = Array.isArray(order.transactions?.payments)
      ? order.transactions?.payments[0]
      : undefined;
    const orderStatus = normalizeString(order.status).toLowerCase();
    const orderStatusDetail = normalizeString(order.status_detail).toLowerCase();
    const paymentStatus = normalizeString(firstPayment?.status).toLowerCase();
    const paymentStatusDetail = normalizeString(firstPayment?.status_detail).toLowerCase();
    const nextActionUrl = normalizeString(
      firstPayment?.payment_method?.transaction_security?.url
    );

    if (
      isApproved({
        orderStatus,
        orderStatusDetail,
        paymentStatus,
        paymentStatusDetail,
      })
    ) {
      await prisma.booking.updateMany({
        where: { id: booking.id },
        data: { status: "paid" },
      });
    }

    const pending = isPending({
      orderStatus,
      orderStatusDetail,
      paymentStatus,
      paymentStatusDetail,
    });

    const message = isApproved({
      orderStatus,
      orderStatusDetail,
      paymentStatus,
      paymentStatusDetail,
    })
      ? "Pago acreditado."
      : pending
        ? "Pago en procesamiento."
        : "Mercado Pago no aprobo el pago.";

    return NextResponse.json({
      ok: true,
      orderId: normalizeString(order.id),
      status: orderStatus || null,
      statusDetail: orderStatusDetail || null,
      paymentStatus: paymentStatus || null,
      paymentStatusDetail: paymentStatusDetail || null,
      nextActionUrl: nextActionUrl || null,
      message,
    });
  } catch (error) {
    const parsed = formatMercadoPagoError(error);
    console.error("[mp/orders] create failed", {
      bookingId: booking.id,
      message: parsed.message,
      status: parsed.status,
      error,
      rawError:
        error && typeof error === "object" ? JSON.stringify(error) : String(error),
    });
    return errorResponse(parsed.message, parsed.status);
  }
}

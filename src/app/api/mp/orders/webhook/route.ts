import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Order } from "mercadopago";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const normalizeString = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value).trim();
  return "";
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const getWebhookSecret = () => process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() || "";

const parseSignatureHeader = (signatureHeader: string) => {
  let ts = "";
  let v1 = "";

  signatureHeader.split(",").forEach((part) => {
    const [rawKey, rawValue] = part.split("=", 2);
    const key = normalizeString(rawKey).toLowerCase();
    const value = normalizeString(rawValue);
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  });

  return { ts, v1 };
};

const isHexDigest = (value: string) => /^[a-f0-9]+$/i.test(value) && value.length % 2 === 0;

const buildSignatureManifest = ({
  orderId,
  requestId,
  ts,
}: {
  orderId: string;
  requestId: string;
  ts: string;
}) => {
  const parts: string[] = [];
  if (orderId) parts.push(`id:${orderId.toLowerCase()}`);
  if (requestId) parts.push(`request-id:${requestId}`);
  if (ts) parts.push(`ts:${ts}`);
  return parts.length ? `${parts.join(";")};` : "";
};

const isValidWebhookSignature = ({
  secret,
  signatureHeader,
  requestId,
  orderId,
}: {
  secret: string;
  signatureHeader: string;
  requestId: string;
  orderId: string;
}) => {
  if (!secret) return true;
  if (!signatureHeader) return false;

  const { ts, v1 } = parseSignatureHeader(signatureHeader);
  if (!ts || !v1) return false;
  if (!isHexDigest(v1)) return false;

  const manifest = buildSignatureManifest({ orderId, requestId, ts });
  if (!manifest) return false;

  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(v1, "hex");
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, receivedBuffer);
};

const getAccessToken = () => {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN no esta configurado.");
  }
  return token;
};

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

const parseOrderIdFromResource = (resource: string) => {
  if (!resource) return "";
  const match = resource.match(/\/v1\/orders\/([^/?#]+)/i);
  return match?.[1]?.trim() || "";
};

const resolveOrderId = (
  request: NextRequest,
  body: Record<string, unknown> | null
) => {
  const bodyData = asRecord(body?.data);
  const fromBody = normalizeString(bodyData?.id || body?.id);
  if (fromBody) return fromBody;

  const queryId = normalizeString(
    request.nextUrl.searchParams.get("data.id") ||
      request.nextUrl.searchParams.get("id")
  );
  if (queryId) return queryId;

  const bodyResource = normalizeString(body?.resource);
  if (bodyResource) return parseOrderIdFromResource(bodyResource);

  const queryResource = normalizeString(request.nextUrl.searchParams.get("resource"));
  if (queryResource) return parseOrderIdFromResource(queryResource);

  return "";
};

const syncBookingFromOrder = async (orderId: string) => {
  const accessToken = getAccessToken();
  const client = new MercadoPagoConfig({
    accessToken,
    options: {
      timeout: 10000,
    },
  });
  const orderClient = new Order(client);
  const order = await orderClient.get({ id: orderId });

  const bookingId = normalizeString(order.external_reference);
  if (!bookingId) return;

  const firstPayment = Array.isArray(order.transactions?.payments)
    ? order.transactions?.payments[0]
    : undefined;
  const orderStatus = normalizeString(order.status).toLowerCase();
  const orderStatusDetail = normalizeString(order.status_detail).toLowerCase();
  const paymentStatus = normalizeString(firstPayment?.status).toLowerCase();
  const paymentStatusDetail = normalizeString(firstPayment?.status_detail).toLowerCase();

  if (
    isApproved({
      orderStatus,
      orderStatusDetail,
      paymentStatus,
      paymentStatusDetail,
    })
  ) {
    await prisma.booking.updateMany({
      where: { id: bookingId },
      data: { status: "paid" },
    });
    return;
  }

};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const orderId = resolveOrderId(request, asRecord(body));
  if (!orderId) {
    return NextResponse.json({ ok: true });
  }
  const signatureOrderId =
    normalizeString(request.nextUrl.searchParams.get("data.id")) || orderId;

  const webhookSecret = getWebhookSecret();
  const isSignatureValid = isValidWebhookSignature({
    secret: webhookSecret,
    signatureHeader: request.headers.get("x-signature") || "",
    requestId: request.headers.get("x-request-id") || "",
    orderId: signatureOrderId,
  });

  if (!isSignatureValid) {
    console.error("[mp/orders/webhook] invalid signature", {
      orderId,
      hasSecret: Boolean(webhookSecret),
    });
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  try {
    await syncBookingFromOrder(orderId);
  } catch (error) {
    console.error("[mp/orders/webhook] failed", { orderId, error });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const orderId = resolveOrderId(request, null);
  if (!orderId) {
    return NextResponse.json({ ok: true });
  }

  try {
    await syncBookingFromOrder(orderId);
  } catch (error) {
    console.error("[mp/orders/webhook] failed", { orderId, error });
  }

  return NextResponse.json({ ok: true });
}

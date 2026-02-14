import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const getAccessToken = () => {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN no está configurado.");
  }
  return token;
};

const normalizeString = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value).trim();
  return "";
};

const isPaidStatus = (status: string) => status === "approved";

const updateBookingStatusFromPayment = async (
  bookingId: string | null,
  status: string
) => {
  if (!bookingId) return;
  if (!isPaidStatus(status)) return;

  await prisma.booking.updateMany({
    where: { id: bookingId },
    data: { status: "paid" },
  });
};

const processNotification = async (paymentId: string) => {
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return;
  }

  const status = normalizeString(data?.status) || "pending";
  const mpPaymentId = normalizeString(data?.id ? String(data.id) : paymentId);
  const localPaymentId = normalizeString(data?.external_reference);
  const metadataExternalReference = normalizeString(
    data?.metadata?.external_reference
  );

  if (!localPaymentId) {
    await updateBookingStatusFromPayment(metadataExternalReference, status);
    return;
  }

  const paymentResult = await prisma.payment.updateMany({
    where: { id: localPaymentId },
    data: {
      mpPaymentId: mpPaymentId || null,
      status,
    },
  });

  if (paymentResult.count === 0) {
    // Compatibilidad con referencias antiguas donde external_reference era booking.id.
    await updateBookingStatusFromPayment(localPaymentId, status);
    return;
  }

  const localPayment = await prisma.payment.findUnique({
    where: { id: localPaymentId },
    select: { externalReference: true },
  });

  await updateBookingStatusFromPayment(
    localPayment?.externalReference || metadataExternalReference || null,
    status
  );
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const type = normalizeString(body?.type || body?.topic);
  const paymentId = normalizeString(body?.data?.id || body?.id);

  if (type !== "payment" || !paymentId) {
    return NextResponse.json({ ok: true });
  }

  await processNotification(paymentId);
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const type = normalizeString(
    request.nextUrl.searchParams.get("type") ||
      request.nextUrl.searchParams.get("topic")
  );
  const paymentId = normalizeString(
    request.nextUrl.searchParams.get("data.id") ||
      request.nextUrl.searchParams.get("id")
  );

  if (type !== "payment" || !paymentId) {
    return NextResponse.json({ ok: true });
  }

  await processNotification(paymentId);
  return NextResponse.json({ ok: true });
}

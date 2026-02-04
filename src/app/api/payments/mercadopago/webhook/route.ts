import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const getAccessToken = () => {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN no está configurado.");
  }
  return token;
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const type = body?.type ?? body?.topic;
  const paymentId = body?.data?.id ?? body?.id;

  if (type !== "payment" || !paymentId) {
    return NextResponse.json({ ok: true });
  }

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
    return NextResponse.json({ ok: true });
  }

  const bookingId = data?.external_reference;
  if (!bookingId) {
    return NextResponse.json({ ok: true });
  }

  if (data.status === "approved") {
    await prisma.booking.updateMany({
      where: { id: bookingId },
      data: { status: "paid" },
    });
  }

  return NextResponse.json({ ok: true });
}

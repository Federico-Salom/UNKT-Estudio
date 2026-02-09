import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE, hashPassword, signSession, verifySession } from "@/lib/auth";
import { autoBlockClosingSlots } from "@/lib/availability";
import { BASE_PRICE, EXTRA_PRICE } from "@/lib/booking";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

type BookingInput = {
  name?: string;
  phone?: string;
  slotId?: string;
  slotIds?: string[];
  extras?: string[];
};

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const buildGuestEmail = (phone: string) => `guest-${phone}@guest.unk`;

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ ok: false, error: message }, { status });

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as BookingInput;
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const slotId = String(body.slotId || "");
  const slotIds = Array.isArray(body.slotIds)
    ? body.slotIds.map((item) => String(item))
    : [];
  const extras = Array.isArray(body.extras)
    ? body.extras.map((item) => String(item))
    : [];

  if (!name) return errorResponse("Escribe tu nombre.");
  if (!phone) return errorResponse("Escribe tu telefono.");

  const selectedSlotIds = Array.from(
    new Set(slotIds.length ? slotIds : slotId ? [slotId] : [])
  );

  if (selectedSlotIds.length === 0) {
    return errorResponse("Selecciona un horario disponible.");
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return errorResponse("Escribe un telefono valido.");
  }

  const guestEmail = buildGuestEmail(normalizedPhone);
  const existingSession = request.cookies.get(AUTH_COOKIE)?.value;
  const sessionPayload = existingSession ? verifySession(existingSession) : null;

  const hours = selectedSlotIds.length;
  const totalPerHour = BASE_PRICE + extras.length * EXTRA_PRICE;
  const total = totalPerHour * hours;
  const cutoff = await autoBlockClosingSlots();

  let result: { user: { id: string; email: string; role: string }; booking: { id: string } };

  try {
    result = await prisma.$transaction(async (tx) => {
      let user =
        sessionPayload?.userId
          ? await tx.user.findUnique({ where: { id: sessionPayload.userId } })
          : null;

      if (!user) {
        user = await tx.user.findUnique({ where: { email: guestEmail } });
      }

      if (!user) {
        const passwordHash = await hashPassword(randomUUID());
        user = await tx.user.create({
          data: {
            email: guestEmail,
            passwordHash,
            role: "user",
          },
        });
      }

      const slots = await tx.availabilitySlot.findMany({
        where: { id: { in: selectedSlotIds } },
      });

      if (slots.length !== selectedSlotIds.length) {
        throw new Error("Algun horario ya no esta disponible.");
      }

      const unavailable = slots.find(
        (slot) =>
          slot.status !== "available" || slot.start.getTime() <= cutoff.getTime()
      );

      if (unavailable) {
        throw new Error(
          "Algun horario ya no esta disponible. Solo se puede reservar con 2 horas de anticipacion."
        );
      }

      const updated = await tx.availabilitySlot.updateMany({
        where: {
          id: { in: selectedSlotIds },
          status: "available",
          start: { gt: cutoff },
        },
        data: { status: "booked" },
      });

      if (updated.count !== selectedSlotIds.length) {
        throw new Error("Algun horario ya no esta disponible.");
      }

      const booking = await tx.booking.create({
        data: {
          userId: user.id,
          slotId: selectedSlotIds[0],
          slotIds: JSON.stringify(selectedSlotIds),
          hours,
          name,
          email: user.email,
          phone,
          extras: JSON.stringify(extras),
          total,
          status: "pending_payment",
        },
      });

      return { user, booking };
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "No se pudo crear la reserva.";
    return errorResponse(message, 400);
  }

  const token = signSession({
    userId: result.user.id,
    email: result.user.email,
    role: result.user.role,
  });

  const response = NextResponse.json(
    {
      ok: true,
      bookingId: result.booking.id,
      redirectTo: `/pago/${result.booking.id}`,
    },
    { status: 201 }
  );

  if (!sessionPayload) {
    response.cookies.set({
      name: AUTH_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  return response;
}

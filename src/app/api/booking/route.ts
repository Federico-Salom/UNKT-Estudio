import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE, hashPassword, signSession, verifyPassword } from "@/lib/auth";
import { BASE_PRICE, EXTRA_PRICE } from "@/lib/booking";

export const runtime = "nodejs";

type BookingInput = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  passwordConfirm?: string;
  slotId?: string;
  slotIds?: string[];
  extras?: string[];
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ ok: false, error: message }, { status });

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as BookingInput;
  const name = String(body.name || "").trim();
  const email = normalizeEmail(String(body.email || ""));
  const phone = String(body.phone || "").trim();
  const password = String(body.password || "");
  const passwordConfirm = String(body.passwordConfirm || "");
  const slotId = String(body.slotId || "");
  const slotIds = Array.isArray(body.slotIds)
    ? body.slotIds.map((item) => String(item))
    : [];
  const extras = Array.isArray(body.extras)
    ? body.extras.map((item) => String(item))
    : [];

  if (!name) return errorResponse("Escribe tu nombre.");
  if (!email) return errorResponse("Escribe tu correo.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse("Correo inválido.");
  }
  if (!phone) return errorResponse("Escribe tu teléfono.");
  const selectedSlotIds = Array.from(
    new Set(slotIds.length ? slotIds : slotId ? [slotId] : [])
  );
  if (selectedSlotIds.length === 0) {
    return errorResponse("Selecciona un horario disponible.");
  }
  if (!password) return errorResponse("Escribe una contraseña.");
  if (password.length < 8) {
    return errorResponse("La contraseña debe tener al menos 8 caracteres.");
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return errorResponse("La contraseña debe incluir letras y números.");
  }
  if (!passwordConfirm) return errorResponse("Repite la contraseña.");
  if (password !== passwordConfirm) {
    return errorResponse("Las contraseñas no coinciden.");
  }

  const hours = selectedSlotIds.length;
  const totalPerHour = BASE_PRICE + extras.length * EXTRA_PRICE;
  const total = totalPerHour * hours;

  let result: { user: { id: string; email: string; role: string }; booking: { id: string } };

  try {
    result = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });

      if (user) {
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          throw new Error("Credenciales inválidas.");
        }
      } else {
        const passwordHash = await hashPassword(password);
        user = await tx.user.create({
          data: {
            email,
            passwordHash,
            role: "user",
          },
        });
      }

      const slots = await tx.availabilitySlot.findMany({
        where: { id: { in: selectedSlotIds } },
      });

      if (slots.length !== selectedSlotIds.length) {
        throw new Error("Algún horario ya no está disponible.");
      }

      const unavailable = slots.find((slot) => slot.status !== "available");
      if (unavailable) {
        throw new Error("Algún horario ya no está disponible.");
      }

      const updated = await tx.availabilitySlot.updateMany({
        where: { id: { in: selectedSlotIds }, status: "available" },
        data: { status: "booked" },
      });

      if (updated.count !== selectedSlotIds.length) {
        throw new Error("Algún horario ya no está disponible.");
      }

      const booking = await tx.booking.create({
        data: {
          userId: user.id,
          slotId: selectedSlotIds[0],
          slotIds: JSON.stringify(selectedSlotIds),
          hours,
          name,
          email,
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

  response.cookies.set({
    name: AUTH_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

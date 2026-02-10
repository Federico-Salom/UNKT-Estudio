import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE, hashPassword, signSession, verifySession } from "@/lib/auth";
import { getAvailabilityCutoffDate } from "@/lib/availability";
import { filterExtrasToAllowed, getExtrasTotal, resolveBasePrice } from "@/lib/booking";
import { getStudioContent } from "@/lib/studio-content";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

type BookingInput = {
  name?: string;
  phone?: string;
  slotId?: string;
  slotIds?: string[];
  extras?: string[];
};

const MIN_BOOKING_HOURS = 2;
const MAINTENANCE_HOURS = 1;
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

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
  const requestedExtras = Array.isArray(body.extras)
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
  if (selectedSlotIds.length < MIN_BOOKING_HOURS) {
    return errorResponse("La reserva minima es de 2 horas consecutivas.");
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return errorResponse("Escribe un telefono valido.");
  }

  const guestEmail = buildGuestEmail(normalizedPhone);
  const existingSession = request.cookies.get(AUTH_COOKIE)?.value;
  const sessionPayload = existingSession ? verifySession(existingSession) : null;
  const studio = await getStudioContent();
  const extras = filterExtrasToAllowed(
    requestedExtras,
    studio.extras.items
  ).slice(0, 1);
  const basePrice = resolveBasePrice(studio.pricing.basePrice);

  const extrasTotal = getExtrasTotal(extras);
  const cutoff = getAvailabilityCutoffDate();

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

      const orderedSlots = [...slots].sort(
        (a, b) => a.start.getTime() - b.start.getTime()
      );
      const areConsecutive = orderedSlots.every((slot, index) => {
        if (index === 0) return true;
        return orderedSlots[index - 1].end.getTime() === slot.start.getTime();
      });

      if (!areConsecutive || orderedSlots.length < MIN_BOOKING_HOURS) {
        throw new Error("La reserva minima es de 2 horas consecutivas.");
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

      const orderedSlotIds = orderedSlots.map((slot) => slot.id);
      const lastSelectedSlot = orderedSlots[orderedSlots.length - 1];
      const maintenanceStart = new Date(lastSelectedSlot.end);
      const maintenanceEnd = new Date(
        maintenanceStart.getTime() + MAINTENANCE_HOURS * ONE_HOUR_IN_MS
      );

      const findOrCreateMaintenanceSlot = async () => {
        let maintenanceSlot = await tx.availabilitySlot.findUnique({
          where: { start: maintenanceStart },
        });

        if (!maintenanceSlot) {
          try {
            maintenanceSlot = await tx.availabilitySlot.create({
              data: {
                start: maintenanceStart,
                end: maintenanceEnd,
                status: "booked",
              },
            });
          } catch {
            maintenanceSlot = await tx.availabilitySlot.findUnique({
              where: { start: maintenanceStart },
            });
          }
        }

        if (!maintenanceSlot) {
          throw new Error(
            "No hay una hora de mantenimiento disponible despues de la reserva."
          );
        }

        if (maintenanceSlot.status === "available") {
          const updatedMaintenance = await tx.availabilitySlot.updateMany({
            where: {
              id: maintenanceSlot.id,
              status: "available",
            },
            data: { status: "booked" },
          });

          if (updatedMaintenance.count === 1) {
            return;
          }

          const refreshedMaintenanceSlot = await tx.availabilitySlot.findUnique({
            where: { id: maintenanceSlot.id },
          });

          if (
            !refreshedMaintenanceSlot ||
            refreshedMaintenanceSlot.status === "booked"
          ) {
            throw new Error(
              "No hay una hora de mantenimiento disponible despues de la reserva."
            );
          }

          return;
        }

        if (maintenanceSlot.status === "booked") {
          throw new Error(
            "No hay una hora de mantenimiento disponible despues de la reserva."
          );
        }
      };

      await findOrCreateMaintenanceSlot();

      const updated = await tx.availabilitySlot.updateMany({
        where: {
          id: { in: orderedSlotIds },
          status: "available",
          start: { gt: cutoff },
        },
        data: { status: "booked" },
      });

      if (updated.count !== orderedSlotIds.length) {
        throw new Error("Algun horario ya no esta disponible.");
      }

      const hours = orderedSlotIds.length;
      const total = basePrice * hours + extrasTotal;

      const booking = await tx.booking.create({
        data: {
          userId: user.id,
          slotId: orderedSlotIds[0],
          slotIds: JSON.stringify(orderedSlotIds),
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

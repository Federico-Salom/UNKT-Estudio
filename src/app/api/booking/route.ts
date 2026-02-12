import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAvailabilityCutoffDate } from "@/lib/availability";
import {
  filterExtrasToAllowed,
  getExtrasTotal,
  resolveBasePrice,
  resolveExtraMaxSelections,
} from "@/lib/booking";
import { AUTH_COOKIE, hashPassword, signSession, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

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
const MIN_NAME_LETTERS = 2;
const MAX_NAME_LENGTH = 60;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;
const MAX_PHONE_LENGTH = 24;
const NAME_ALLOWED_REGEX = /^[\p{L}\s'-]+$/u;
const PHONE_ALLOWED_REGEX = /^[\d+\s()-]+$/;

const normalizeName = (value: string) => value.replace(/\s+/g, " ").trim();
const normalizePhoneInput = (value: string) => value.replace(/\s+/g, " ").trim();
const normalizePhone = (value: string) => value.replace(/\D/g, "");

const getNameLetterCount = (value: string) =>
  (value.match(/\p{L}/gu) ?? []).length;

const hasPhonePlusInValidPosition = (value: string) => {
  const plusCount = (value.match(/\+/g) ?? []).length;
  if (plusCount === 0) return true;
  return plusCount === 1 && value.startsWith("+");
};

const hasValidName = (value: string) => {
  const normalized = normalizeName(value);
  if (!normalized || normalized.length > MAX_NAME_LENGTH) return false;
  if (!NAME_ALLOWED_REGEX.test(normalized)) return false;
  return getNameLetterCount(normalized) >= MIN_NAME_LETTERS;
};

const hasValidPhone = (value: string) => {
  const normalized = normalizePhoneInput(value);
  if (!normalized || normalized.length > MAX_PHONE_LENGTH) return false;
  if (!hasPhonePlusInValidPosition(normalized)) return false;
  if (!PHONE_ALLOWED_REGEX.test(normalized)) return false;
  const digits = normalizePhone(normalized);
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS;
};
const buildGuestEmail = (phone: string) => `guest-${phone}@guest.unk`;

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ ok: false, error: message }, { status });

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as BookingInput;
  const requestedName = normalizeName(String(body.name || ""));
  const requestedPhone = normalizePhoneInput(String(body.phone || ""));
  const slotId = String(body.slotId || "");
  const slotIds = Array.isArray(body.slotIds)
    ? body.slotIds.map((item) => String(item))
    : [];
  const requestedExtras = Array.isArray(body.extras)
    ? body.extras.map((item) => String(item))
    : [];

  const selectedSlotIds = Array.from(
    new Set(slotIds.length ? slotIds : slotId ? [slotId] : [])
  );

  if (selectedSlotIds.length === 0) {
    return errorResponse("Selecciona un horario disponible.");
  }
  if (selectedSlotIds.length < MIN_BOOKING_HOURS) {
    return errorResponse("La reserva mínima es de 2 horas consecutivas.");
  }

  const existingSession = request.cookies.get(AUTH_COOKIE)?.value;
  const sessionPayload = existingSession ? verifySession(existingSession) : null;
  const normalizedRequestedPhone = normalizePhone(requestedPhone);

  if (!requestedName) return errorResponse("Escribe tu nombre.");
  if (!hasValidName(requestedName)) {
    return errorResponse(
      "El nombre solo puede incluir letras, espacios, apóstrofes y guiones."
    );
  }
  if (!requestedPhone) return errorResponse("Escribe tu teléfono.");
  if (!hasValidPhone(requestedPhone)) {
    return errorResponse("Escribe un teléfono válido.");
  }

  const guestEmail = sessionPayload
    ? null
    : buildGuestEmail(normalizedRequestedPhone);

  const studio = await getStudioContent();
  const extras = filterExtrasToAllowed(
    requestedExtras,
    studio.extras.backgrounds,
    resolveExtraMaxSelections(studio.extras.maxSelections)
  );
  const basePrice = resolveBasePrice(studio.pricing.basePrice);
  const extrasTotal = getExtrasTotal(extras, studio.extras.backgrounds);
  const cutoff = getAvailabilityCutoffDate();

  let result: {
    user: { id: string; email: string; role: string };
    booking: { id: string };
  };

  try {
    result = await prisma.$transaction(async (tx) => {
      let user =
        sessionPayload?.userId
          ? await tx.user.findUnique({ where: { id: sessionPayload.userId } })
          : null;

      if (sessionPayload?.userId && !user) {
        throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
      }

      if (!user && guestEmail) {
        user = await tx.user.findUnique({ where: { email: guestEmail } });
      }

      if (!user) {
        if (!guestEmail) {
          throw new Error("Escribe un teléfono válido.");
        }

        const passwordHash = await hashPassword(randomUUID());
        user = await tx.user.create({
          data: {
            email: guestEmail,
            passwordHash,
            role: "user",
          },
        });
      }

      const storedName = normalizeName(user.name || "");
      const storedPhone = normalizePhoneInput(user.phone || "");
      const hasStoredContact = hasValidName(storedName) && hasValidPhone(storedPhone);
      const hasVerifiedContact = Boolean(
        (user.bookingContactVerified || hasStoredContact) && hasStoredContact
      );

      let bookingName = storedName;
      let bookingPhone = storedPhone;

      if (!hasVerifiedContact) {
        if (!requestedName) {
          throw new Error("Escribe tu nombre.");
        }
        if (!hasValidName(requestedName)) {
          throw new Error(
            "El nombre solo puede incluir letras, espacios, apóstrofes y guiones."
          );
        }
        if (!requestedPhone) {
          throw new Error("Escribe tu teléfono.");
        }
        if (!hasValidPhone(requestedPhone)) {
          throw new Error("Escribe un teléfono válido.");
        }

        bookingName = requestedName;
        bookingPhone = requestedPhone;

        user = await tx.user.update({
          where: { id: user.id },
          data: {
            name: requestedName,
            phone: requestedPhone,
            bookingContactVerified: true,
          },
        });
      }

      const slots = await tx.availabilitySlot.findMany({
        where: { id: { in: selectedSlotIds } },
      });

      if (slots.length !== selectedSlotIds.length) {
        throw new Error("Algún horario ya no está disponible.");
      }

      const orderedSlots = [...slots].sort(
        (a, b) => a.start.getTime() - b.start.getTime()
      );
      const areConsecutive = orderedSlots.every((slot, index) => {
        if (index === 0) return true;
        return orderedSlots[index - 1].end.getTime() === slot.start.getTime();
      });

      if (!areConsecutive || orderedSlots.length < MIN_BOOKING_HOURS) {
        throw new Error("La reserva mínima es de 2 horas consecutivas.");
      }

      const unavailable = slots.find(
        (slot) =>
          slot.status !== "available" || slot.start.getTime() <= cutoff.getTime()
      );

      if (unavailable) {
        throw new Error(
          "Algún horario ya no está disponible. Solo se puede reservar con 2 horas de anticipación."
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
            "No hay una hora de mantenimiento disponible después de la reserva."
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
              "No hay una hora de mantenimiento disponible después de la reserva."
            );
          }

          return;
        }

        if (maintenanceSlot.status === "booked") {
          throw new Error(
            "No hay una hora de mantenimiento disponible después de la reserva."
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
        throw new Error("Algún horario ya no está disponible.");
      }

      const hours = orderedSlotIds.length;
      const total = basePrice * hours + extrasTotal;

      const booking = await tx.booking.create({
        data: {
          userId: user.id,
          slotId: orderedSlotIds[0],
          slotIds: JSON.stringify(orderedSlotIds),
          hours,
          name: bookingName,
          email: user.email,
          phone: bookingPhone,
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
      redirectTo: `/checkout?bookingId=${result.booking.id}`,
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

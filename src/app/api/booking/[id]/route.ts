import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAvailabilityCutoffDate } from "@/lib/availability";
import { AUTH_COOKIE, verifySession } from "@/lib/auth";
import {
  calculateBookingPricing,
  filterExtrasToAllowed,
  getConfiguredBookingHolidayDates,
  getExtrasTotal,
  resolveBasePrice,
  resolveExtraMaxSelections,
} from "@/lib/booking";
import {
  getServicesBreakdown,
  normalizeBookingServicesSelection,
  parseStoredServicesSelection,
  stringifyServicesSelection,
} from "@/lib/services";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type BookingUpdateInput = {
  slotIds?: string[];
  extras?: string[];
  services?: unknown;
};

class BookingUpdateError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const MIN_BOOKING_HOURS = 2;
const MAINTENANCE_HOURS = 1;
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ ok: false, error: message }, { status });

const parseStringArray = (value: string) => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item)).filter(Boolean);
  } catch {
    return [];
  }
};

const getBookingSlotIds = (slotIdsValue: string, slotId: string | null) => {
  const parsed = parseStringArray(slotIdsValue);
  if (parsed.length) {
    return Array.from(new Set(parsed));
  }
  if (slotId) {
    return [slotId];
  }
  return [];
};

const areConsecutiveSlots = (slots: { start: Date; end: Date }[]) =>
  slots.every((slot, index) => {
    if (index === 0) return true;
    return slots[index - 1].end.getTime() === slot.start.getTime();
  });

const ensureMaintenanceSlotBooked = async (
  tx: Prisma.TransactionClient,
  start: Date,
  end: Date
) => {
  let maintenanceSlot = await tx.availabilitySlot.findUnique({
    where: { start },
  });

  if (!maintenanceSlot) {
    try {
      maintenanceSlot = await tx.availabilitySlot.create({
        data: {
          start,
          end,
          status: "booked",
        },
      });
      return maintenanceSlot;
    } catch {
      maintenanceSlot = await tx.availabilitySlot.findUnique({
        where: { start },
      });
    }
  }

  if (!maintenanceSlot) {
    throw new BookingUpdateError(
      "No hay una hora de mantenimiento disponible despues de la reserva."
    );
  }

  if (maintenanceSlot.status === "booked") {
    return maintenanceSlot;
  }

  const updated = await tx.availabilitySlot.updateMany({
    where: {
      id: maintenanceSlot.id,
      status: "available",
    },
    data: { status: "booked" },
  });

  if (updated.count === 1) {
    return maintenanceSlot;
  }

  throw new BookingUpdateError(
    "No hay una hora de mantenimiento disponible despues de la reserva."
  );
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const bookingId = params.id?.trim();
  if (!bookingId) {
    return errorResponse("Reserva invalida.");
  }

  const sessionToken = request.cookies.get(AUTH_COOKIE)?.value;
  const session = sessionToken ? verifySession(sessionToken) : null;

  if (!session) {
    return errorResponse("No autorizado.", 401);
  }

  const body = (await request.json().catch(() => ({}))) as BookingUpdateInput;
  const hasSlotIds = Array.isArray(body.slotIds);
  const hasExtras = Array.isArray(body.extras);
  const hasServices =
    typeof body.services === "object" &&
    body.services !== null &&
    !Array.isArray(body.services);

  if (!hasSlotIds && !hasExtras && !hasServices) {
    return errorResponse("No hay cambios para actualizar.");
  }

  const requestedSlotIds = hasSlotIds
    ? Array.from(new Set((body.slotIds || []).map((item) => String(item))))
    : null;
  const requestedExtras = hasExtras
    ? (body.extras || []).map((item) => String(item))
    : null;
  const requestedServices = hasServices ? body.services : null;

  if (requestedSlotIds && requestedSlotIds.length < MIN_BOOKING_HOURS) {
    return errorResponse("La reserva minima es de 2 horas consecutivas.");
  }

  const studio = await getStudioContent();
  const basePrice = resolveBasePrice(studio.pricing.basePrice);
  const bookingHolidayDates = getConfiguredBookingHolidayDates();
  const cutoff = getAvailabilityCutoffDate();

  try {
    const updatedBooking = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          userId: true,
          slotId: true,
          slotIds: true,
          extras: true,
          services: true,
          status: true,
        },
      });

      if (!booking) {
        throw new BookingUpdateError("Reserva no encontrada.", 404);
      }

      const canEdit = session.role === "admin" || booking.userId === session.userId;
      if (!canEdit) {
        throw new BookingUpdateError("No tienes permisos para editar esta reserva.", 403);
      }

      if (booking.status !== "pending_payment") {
        throw new BookingUpdateError(
          "Solo puedes editar reservas con pago pendiente."
        );
      }

      const currentSlotIds = getBookingSlotIds(booking.slotIds, booking.slotId);
      if (!currentSlotIds.length) {
        throw new BookingUpdateError("La reserva no tiene horarios asociados.");
      }

      const nextRawSlotIds = requestedSlotIds ?? currentSlotIds;
      const nextSlotIds = Array.from(new Set(nextRawSlotIds));

      if (nextSlotIds.length < MIN_BOOKING_HOURS) {
        throw new BookingUpdateError("La reserva minima es de 2 horas consecutivas.");
      }

      const [currentSlots, nextSlots] = await Promise.all([
        tx.availabilitySlot.findMany({
          where: { id: { in: currentSlotIds } },
          select: {
            id: true,
            start: true,
            end: true,
            status: true,
          },
        }),
        tx.availabilitySlot.findMany({
          where: { id: { in: nextSlotIds } },
          select: {
            id: true,
            start: true,
            end: true,
            status: true,
          },
        }),
      ]);

      if (nextSlots.length !== nextSlotIds.length) {
        throw new BookingUpdateError("Alguno de los horarios seleccionados ya no existe.");
      }

      if (currentSlots.length !== currentSlotIds.length) {
        throw new BookingUpdateError("No se pudieron recuperar los horarios actuales.");
      }

      const orderedCurrentSlots = [...currentSlots].sort(
        (a, b) => a.start.getTime() - b.start.getTime()
      );
      const orderedNextSlots = [...nextSlots].sort(
        (a, b) => a.start.getTime() - b.start.getTime()
      );

      if (!areConsecutiveSlots(orderedNextSlots)) {
        throw new BookingUpdateError("Las horas seleccionadas deben ser consecutivas.");
      }

      const orderedCurrentSlotIds = orderedCurrentSlots.map((slot) => slot.id);
      const orderedNextSlotIds = orderedNextSlots.map((slot) => slot.id);
      const slotsChanged =
        orderedCurrentSlotIds.length !== orderedNextSlotIds.length ||
        orderedCurrentSlotIds.some((slotId, index) => slotId !== orderedNextSlotIds[index]);

      if (slotsChanged) {
        const currentStartsInPast = orderedCurrentSlots.some(
          (slot) => slot.start.getTime() <= cutoff.getTime()
        );
        if (currentStartsInPast) {
          throw new BookingUpdateError(
            "No se puede reprogramar con menos de 2 horas de anticipacion."
          );
        }

        const nextStartsInPast = orderedNextSlots.some(
          (slot) => slot.start.getTime() <= cutoff.getTime()
        );
        if (nextStartsInPast) {
          throw new BookingUpdateError(
            "Solo se puede reprogramar con 2 horas de anticipacion."
          );
        }

        const currentSlotIdSet = new Set(orderedCurrentSlotIds);
        const nextSlotIdSet = new Set(orderedNextSlotIds);
        const toBookIds = orderedNextSlotIds.filter(
          (slotId) => !currentSlotIdSet.has(slotId)
        );
        const toReleaseIds = orderedCurrentSlotIds.filter(
          (slotId) => !nextSlotIdSet.has(slotId)
        );

        const hasUnavailableNewSlot = orderedNextSlots.some(
          (slot) => !currentSlotIdSet.has(slot.id) && slot.status !== "available"
        );

        if (hasUnavailableNewSlot) {
          throw new BookingUpdateError("Alguno de los horarios ya no esta disponible.");
        }

        if (toBookIds.length) {
          const booked = await tx.availabilitySlot.updateMany({
            where: {
              id: { in: toBookIds },
              status: "available",
              start: { gt: cutoff },
            },
            data: { status: "booked" },
          });

          if (booked.count !== toBookIds.length) {
            throw new BookingUpdateError("Alguno de los horarios ya no esta disponible.");
          }
        }

        if (toReleaseIds.length) {
          await tx.availabilitySlot.updateMany({
            where: {
              id: { in: toReleaseIds },
              status: "booked",
            },
            data: { status: "available" },
          });
        }

        const oldLastSlot = orderedCurrentSlots[orderedCurrentSlots.length - 1];
        const newLastSlot = orderedNextSlots[orderedNextSlots.length - 1];
        const oldMaintenanceStart = oldLastSlot.end;
        const newMaintenanceStart = newLastSlot.end;

        if (oldMaintenanceStart.getTime() !== newMaintenanceStart.getTime()) {
          const newMaintenanceEnd = new Date(
            newMaintenanceStart.getTime() + MAINTENANCE_HOURS * ONE_HOUR_IN_MS
          );
          await ensureMaintenanceSlotBooked(tx, newMaintenanceStart, newMaintenanceEnd);

          const oldMaintenanceSlot = await tx.availabilitySlot.findUnique({
            where: { start: oldMaintenanceStart },
          });

          if (
            oldMaintenanceSlot &&
            oldMaintenanceSlot.status === "booked" &&
            !new Set(orderedNextSlotIds).has(oldMaintenanceSlot.id)
          ) {
            await tx.availabilitySlot.updateMany({
              where: {
                id: oldMaintenanceSlot.id,
                status: "booked",
              },
              data: { status: "available" },
            });
          }
        }
      }

      const nextExtrasInput = requestedExtras ?? parseStringArray(booking.extras);
      const normalizedExtras = filterExtrasToAllowed(
        nextExtrasInput,
        studio.extras.backgrounds,
        resolveExtraMaxSelections(studio.extras.maxSelections)
      );
      const extrasTotal = getExtrasTotal(normalizedExtras, studio.extras.backgrounds);
      const currentServicesSelection = parseStoredServicesSelection(
        booking.services || "[]",
        studio.services
      );
      const nextServicesSelection = requestedServices
        ? normalizeBookingServicesSelection(requestedServices, studio.services)
        : currentServicesSelection;
      const servicesBreakdown = getServicesBreakdown({
        selection: nextServicesSelection,
        catalog: studio.services,
        hours: orderedNextSlotIds.length,
      });
      if (servicesBreakdown.errors.length) {
        throw new BookingUpdateError(servicesBreakdown.errors[0]);
      }
      const pricing = calculateBookingPricing({
        basePrice,
        extrasTotal,
        servicesTotal: servicesBreakdown.total,
        slots: orderedNextSlots,
        holidayDates: bookingHolidayDates,
      });
      const total = pricing.grandTotal;

      return tx.booking.update({
        where: { id: booking.id },
        data: {
          slotId: orderedNextSlotIds[0],
          slotIds: JSON.stringify(orderedNextSlotIds),
          hours: orderedNextSlotIds.length,
          extras: JSON.stringify(normalizedExtras),
          services: stringifyServicesSelection(
            servicesBreakdown.selection,
            studio.services
          ),
          total,
        },
        select: { id: true },
      });
    });

    return NextResponse.json(
      {
        ok: true,
        bookingId: updatedBooking.id,
        redirectTo: `/checkout?bookingId=${updatedBooking.id}`,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof BookingUpdateError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse("No se pudo actualizar la reserva.");
  }
}

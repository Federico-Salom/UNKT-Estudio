import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ONE_HOUR_IN_MS = 60 * 60 * 1000;

export const PENDING_PAYMENT_EXPIRATION_MS = ONE_HOUR_IN_MS;
export const PENDING_PAYMENT_EXPIRATION_MINUTES =
  PENDING_PAYMENT_EXPIRATION_MS / (60 * 1000);

type BookingSlotSnapshot = {
  id: string;
  slotId: string | null;
  slotIds: string;
};

export type PendingBookingCleanupResult = {
  expiredBookings: number;
  releasedSlots: number;
};

const ACTIVE_BOOKING_STATUSES = ["pending_payment", "paid"] as const;

const parseStringArray = (value: string) => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item)).filter(Boolean);
  } catch {
    return [];
  }
};

export const getBookingSlotIds = (slotIdsValue: string, slotId: string | null) => {
  const parsed = parseStringArray(slotIdsValue);
  if (parsed.length) {
    return Array.from(new Set(parsed));
  }
  if (slotId) {
    return [slotId];
  }
  return [];
};

const sortByStartAsc = (
  slots: Array<{
    id: string;
    start: Date;
    end: Date;
  }>
) => [...slots].sort((slotA, slotB) => slotA.start.getTime() - slotB.start.getTime());

export const releaseSlotsLinkedToBookings = async (
  tx: Prisma.TransactionClient,
  bookings: BookingSlotSnapshot[],
  excludedBookingIds: string[] = []
) => {
  if (!bookings.length) {
    return 0;
  }

  const selectedSlotIds = Array.from(
    new Set(
      bookings.flatMap((booking) => getBookingSlotIds(booking.slotIds, booking.slotId))
    )
  );

  if (!selectedSlotIds.length) {
    return 0;
  }

  const selectedSlots = await tx.availabilitySlot.findMany({
    where: { id: { in: selectedSlotIds } },
    select: {
      id: true,
      start: true,
      end: true,
    },
  });

  const selectedSlotById = new Map(selectedSlots.map((slot) => [slot.id, slot]));
  const maintenanceStartByTimestamp = new Map<number, Date>();

  bookings.forEach((booking) => {
    const bookingSlots = getBookingSlotIds(booking.slotIds, booking.slotId)
      .map((slotId) => selectedSlotById.get(slotId))
      .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot));
    const orderedBookingSlots = sortByStartAsc(bookingSlots);
    const lastSlot = orderedBookingSlots[orderedBookingSlots.length - 1];
    if (lastSlot) {
      maintenanceStartByTimestamp.set(lastSlot.end.getTime(), lastSlot.end);
    }
  });

  const maintenanceStarts = Array.from(maintenanceStartByTimestamp.values());
  const maintenanceSlots = maintenanceStarts.length
    ? await tx.availabilitySlot.findMany({
        where: {
          start: { in: maintenanceStarts },
        },
        select: { id: true },
      })
    : [];

  const candidateReleaseSlotIds = new Set<string>([
    ...selectedSlotIds,
    ...maintenanceSlots.map((slot) => slot.id),
  ]);

  if (!candidateReleaseSlotIds.size) {
    return 0;
  }

  const activeBookingsWhere: Prisma.BookingWhereInput = {
    status: { in: [...ACTIVE_BOOKING_STATUSES] },
  };
  if (excludedBookingIds.length) {
    activeBookingsWhere.id = { notIn: excludedBookingIds };
  }

  const activeBookings = await tx.booking.findMany({
    where: activeBookingsWhere,
    select: {
      slotId: true,
      slotIds: true,
    },
  });

  const protectedSlotIds = new Set(
    activeBookings.flatMap((booking) => getBookingSlotIds(booking.slotIds, booking.slotId))
  );

  const releasableSlotIds = Array.from(candidateReleaseSlotIds).filter(
    (slotId) => !protectedSlotIds.has(slotId)
  );

  if (!releasableSlotIds.length) {
    return 0;
  }

  const released = await tx.availabilitySlot.updateMany({
    where: {
      id: { in: releasableSlotIds },
      status: "booked",
    },
    data: {
      status: "available",
    },
  });

  return released.count;
};

export const getPendingPaymentExpirationCutoff = (now = new Date()) =>
  new Date(now.getTime() - PENDING_PAYMENT_EXPIRATION_MS);

export const pruneExpiredPendingBookings = async (
  now = new Date()
): Promise<PendingBookingCleanupResult> => {
  const cutoff = getPendingPaymentExpirationCutoff(now);

  try {
    return await prisma.$transaction(async (tx) => {
      const expiredPendingBookings = await tx.booking.findMany({
        where: {
          status: "pending_payment",
          createdAt: {
            lte: cutoff,
          },
        },
        select: {
          id: true,
          slotId: true,
          slotIds: true,
        },
      });

      if (!expiredPendingBookings.length) {
        return {
          expiredBookings: 0,
          releasedSlots: 0,
        };
      }

      const pendingBookingIds = expiredPendingBookings.map((booking) => booking.id);
      const expiredById = new Map(
        expiredPendingBookings.map((booking) => [booking.id, booking])
      );

      await tx.booking.deleteMany({
        where: {
          id: { in: pendingBookingIds },
          status: "pending_payment",
        },
      });

      const stillExistingBookings = await tx.booking.findMany({
        where: {
          id: { in: pendingBookingIds },
        },
        select: { id: true },
      });

      const existingBookingIds = new Set(stillExistingBookings.map((booking) => booking.id));
      const deletedBookings = pendingBookingIds
        .filter((bookingId) => !existingBookingIds.has(bookingId))
        .map((bookingId) => expiredById.get(bookingId))
        .filter((booking): booking is BookingSlotSnapshot => Boolean(booking));

      if (!deletedBookings.length) {
        return {
          expiredBookings: 0,
          releasedSlots: 0,
        };
      }

      const releasedSlots = await releaseSlotsLinkedToBookings(
        tx,
        deletedBookings,
        deletedBookings.map((booking) => booking.id)
      );

      return {
        expiredBookings: deletedBookings.length,
        releasedSlots,
      };
    });
  } catch {
    return {
      expiredBookings: 0,
      releasedSlots: 0,
    };
  }
};

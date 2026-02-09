import { prisma } from "@/lib/prisma";
import { BOOKING_MIN_LEAD_HOURS } from "@/lib/booking";

export const getAvailabilityCutoffDate = (now = new Date()) => {
  return new Date(now.getTime() + BOOKING_MIN_LEAD_HOURS * 60 * 60 * 1000);
};

export const autoBlockClosingSlots = async (now = new Date()) => {
  const cutoff = getAvailabilityCutoffDate(now);

  await prisma.availabilitySlot.updateMany({
    where: {
      status: "available",
      start: { lte: cutoff },
    },
    data: { status: "blocked" },
  });

  return cutoff;
};

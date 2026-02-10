import { BOOKING_MIN_LEAD_HOURS } from "@/lib/booking";

export const getAvailabilityCutoffDate = (now = new Date()) => {
  return new Date(now.getTime() + BOOKING_MIN_LEAD_HOURS * 60 * 60 * 1000);
};

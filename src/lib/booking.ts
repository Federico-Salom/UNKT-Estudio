export const BASE_PRICE = 40000;
export const EXTRA_PRICE = 15000;

export const BOOKING_TIMEZONE =
  process.env.BOOKING_TIMEZONE || "America/Argentina/Buenos_Aires";
export const BOOKING_TZ_OFFSET = process.env.BOOKING_TZ_OFFSET || "-03:00";

export const buildDateTime = (date: string, time: string) => {
  return new Date(`${date}T${time}:00${BOOKING_TZ_OFFSET}`);
};

export const formatSlotLabel = (date: Date) => {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: BOOKING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const DEFAULT_BASE_PRICE = 40000;
export const BASE_PRICE = DEFAULT_BASE_PRICE;
export const DEFAULT_EXTRA_PRICE = 15000;
export const EXTRA_PRICE = DEFAULT_EXTRA_PRICE;
export const EXTRA_PRICE_BY_LABEL: Record<string, number> = {
  "Bajada de fondo sin pisar - $20.000": 20000,
  "Bajada de fondo pisando - $35.000": 35000,
};

const normalizeExtraLabel = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const parsedExtraPrices = new Map(
  Object.entries(EXTRA_PRICE_BY_LABEL).map(([label, price]) => [
    normalizeExtraLabel(label),
    price,
  ])
);

const parseExtraPriceFromLabel = (label: string) => {
  const moneyMatch = label.match(/\$\s*([\d.,]+)/);
  if (moneyMatch?.[1]) {
    const normalized = moneyMatch[1].replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    if (Number.isFinite(value) && value > 0) {
      return Math.round(value);
    }
  }

  const thousandMatch = label.match(/(\d+(?:[.,]\d+)?)\s*mil/i);
  if (thousandMatch?.[1]) {
    const normalized = thousandMatch[1].replace(",", ".");
    const value = Number(normalized);
    if (Number.isFinite(value) && value > 0) {
      return Math.round(value * 1000);
    }
  }

  return null;
};

export const dedupeExtras = (extras: string[]) =>
  Array.from(
    new Set(
      extras
        .map((extra) => extra.trim())
        .filter(Boolean)
    )
  );

export const filterExtrasToAllowed = (
  extras: string[],
  allowedExtras: string[]
) => {
  const allowedByKey = new Map(
    dedupeExtras(allowedExtras).map((extra) => [normalizeExtraLabel(extra), extra])
  );
  const seen = new Set<string>();

  return dedupeExtras(extras).flatMap((extra) => {
    const key = normalizeExtraLabel(extra);
    if (!key || seen.has(key)) {
      return [];
    }
    const allowed = allowedByKey.get(key);
    if (!allowed) {
      return [];
    }
    seen.add(key);
    return [allowed];
  });
};

export const getExtraPrice = (label: string) => {
  const normalized = normalizeExtraLabel(label);
  if (!normalized) return 0;
  const configuredPrice = parsedExtraPrices.get(normalized);
  if (configuredPrice !== undefined) {
    return configuredPrice;
  }
  return parseExtraPriceFromLabel(label) ?? DEFAULT_EXTRA_PRICE;
};

export const buildExtraPriceMap = (extras: string[]) =>
  Object.fromEntries(
    dedupeExtras(extras).map((extra) => [extra, getExtraPrice(extra)])
  );

export const getExtrasTotal = (extras: string[]) =>
  dedupeExtras(extras).reduce((total, extra) => total + getExtraPrice(extra), 0);

export const resolveBasePrice = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_BASE_PRICE;
  }
  return Math.round(parsed);
};

export const BOOKING_TIMEZONE =
  process.env.BOOKING_TIMEZONE || "America/Argentina/Buenos_Aires";
export const BOOKING_TZ_OFFSET = process.env.BOOKING_TZ_OFFSET || "-03:00";
export const BOOKING_MIN_LEAD_HOURS = Math.max(
  0,
  Number(process.env.BOOKING_MIN_LEAD_HOURS || "2")
);

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

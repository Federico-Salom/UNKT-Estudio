import type { ExtraBackground } from "@/content/studio";

export const DEFAULT_BASE_PRICE = 40000;
export const BASE_PRICE = DEFAULT_BASE_PRICE;
export const DEFAULT_EXTRA_PRICE = 15000;
export const EXTRA_PRICE = DEFAULT_EXTRA_PRICE;
export const DEFAULT_EXTRA_PRICE_SIN_PISAR = 20000;
export const DEFAULT_EXTRA_PRICE_PISANDO = 35000;
export const MAX_EXTRA_BACKGROUNDS = 5;

export type ExtraMode = "sin_pisar" | "pisando";

export type ResolvedExtraSelection = {
  backgroundId: string;
  color: string;
  mode: ExtraMode;
  label: string;
  price: number;
};

const EXTRA_PRICE_BY_LABEL: Record<string, number> = {
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

const normalizeExtraId = (value: string) =>
  normalizeExtraLabel(value).replace(/\s+/g, "-");

const formatLegacyPrice = (value: number) => `$${Math.round(value).toLocaleString("es-AR")}`;

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

const parsedExtraPrices = new Map(
  Object.entries(EXTRA_PRICE_BY_LABEL).map(([label, price]) => [
    normalizeExtraLabel(label),
    price,
  ])
);

const resolvePrice = (value: unknown, fallback: number) => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
};

const parseModeFromLabel = (label: string): ExtraMode | null => {
  const normalized = normalizeExtraLabel(label);
  if (!normalized) return null;
  if (normalized.includes("sin pisar")) {
    return "sin_pisar";
  }
  if (normalized.includes("pisando")) {
    return "pisando";
  }
  return null;
};

const formatModeLabel = (mode: ExtraMode) =>
  mode === "pisando" ? "pisando" : "sin pisar";

const buildLegacyExtraLabel = (color: string, mode: ExtraMode) =>
  `Fondo ${color} (${formatModeLabel(mode)})`;

const buildResolvedSelection = (
  background: ExtraBackground,
  mode: ExtraMode
): ResolvedExtraSelection => ({
  backgroundId: background.id,
  color: background.color,
  mode,
  label: buildLegacyExtraLabel(background.color, mode),
  price: mode === "pisando" ? background.pricePisando : background.priceSinPisar,
});

const buildSelectionByLabel = (backgrounds: ExtraBackground[]) => {
  const lookup = new Map<string, ResolvedExtraSelection>();

  backgrounds.forEach((background) => {
    const sinPisar = buildResolvedSelection(background, "sin_pisar");
    const pisando = buildResolvedSelection(background, "pisando");
    lookup.set(normalizeExtraLabel(sinPisar.label), sinPisar);
    lookup.set(normalizeExtraLabel(pisando.label), pisando);
  });

  return lookup;
};

const findBackgroundByColorMention = (
  normalizedLabel: string,
  backgrounds: ExtraBackground[]
) =>
  backgrounds.find((background) =>
    normalizedLabel.includes(normalizeExtraLabel(background.color))
  );

export const dedupeExtras = (extras: string[]) =>
  Array.from(
    new Set(
      extras
        .map((extra) => extra.trim())
        .filter(Boolean)
    )
  );

export const normalizeExtraBackgrounds = (
  backgrounds: ExtraBackground[]
): ExtraBackground[] => {
  const usedIds = new Set<string>();

  return backgrounds
    .flatMap((background, index) => {
      const color = String(background.color || "").trim();
      if (!color) {
        return [];
      }

      const baseId =
        normalizeExtraId(String(background.id || "")) ||
        normalizeExtraId(color) ||
        `fondo-${index + 1}`;
      let id = baseId;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);

      return [
        {
          id,
          color,
          priceSinPisar: resolvePrice(
            background.priceSinPisar,
            DEFAULT_EXTRA_PRICE_SIN_PISAR
          ),
          pricePisando: resolvePrice(
            background.pricePisando,
            DEFAULT_EXTRA_PRICE_PISANDO
          ),
        },
      ];
    })
    .slice(0, MAX_EXTRA_BACKGROUNDS);
};

export const resolveExtraMaxSelections = (value: unknown) => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return MAX_EXTRA_BACKGROUNDS;
  }
  return Math.min(MAX_EXTRA_BACKGROUNDS, parsed);
};

export const buildExtraSelectionLabel = (
  color: string,
  mode: ExtraMode
) => buildLegacyExtraLabel(color, mode);

export const resolveExtrasFromLabels = (
  extras: string[],
  backgrounds: ExtraBackground[],
  maxSelections = MAX_EXTRA_BACKGROUNDS
) => {
  const normalizedBackgrounds = normalizeExtraBackgrounds(backgrounds);
  if (!normalizedBackgrounds.length) {
    return [];
  }

  const safeMaxSelections = Math.max(
    1,
    Math.min(resolveExtraMaxSelections(maxSelections), MAX_EXTRA_BACKGROUNDS)
  );
  const byLabel = buildSelectionByLabel(normalizedBackgrounds);
  const seenBackgroundIds = new Set<string>();
  const resolved: ResolvedExtraSelection[] = [];

  for (const rawExtra of dedupeExtras(extras)) {
    if (resolved.length >= safeMaxSelections) {
      break;
    }

    const normalized = normalizeExtraLabel(rawExtra);
    if (!normalized) continue;

    let selection = byLabel.get(normalized);

    if (!selection) {
      const mode = parseModeFromLabel(rawExtra);
      const background = mode
        ? findBackgroundByColorMention(normalized, normalizedBackgrounds)
        : null;
      if (background && mode) {
        selection = buildResolvedSelection(background, mode);
      }
    }

    if (!selection) {
      continue;
    }

    if (seenBackgroundIds.has(selection.backgroundId)) {
      continue;
    }

    seenBackgroundIds.add(selection.backgroundId);
    resolved.push(selection);
  }

  return resolved;
};

export const filterExtrasToAllowed = (
  extras: string[],
  backgrounds: ExtraBackground[],
  maxSelections = MAX_EXTRA_BACKGROUNDS
) =>
  resolveExtrasFromLabels(extras, backgrounds, maxSelections).map(
    (selection) => selection.label
  );

export const getExtraPrice = (
  label: string,
  backgrounds: ExtraBackground[] = []
) => {
  const fromBackgrounds = resolveExtrasFromLabels([label], backgrounds, 1)[0];
  if (fromBackgrounds) {
    return fromBackgrounds.price;
  }

  const normalized = normalizeExtraLabel(label);
  if (!normalized) return 0;

  const configuredPrice = parsedExtraPrices.get(normalized);
  if (configuredPrice !== undefined) {
    return configuredPrice;
  }

  return parseExtraPriceFromLabel(label) ?? DEFAULT_EXTRA_PRICE;
};

export const buildExtraPriceMap = (extras: string[] | ExtraBackground[]) => {
  if (!extras.length) {
    return {};
  }

  if (typeof extras[0] === "string") {
    return Object.fromEntries(
      dedupeExtras(extras as string[]).map((extra) => [extra, getExtraPrice(extra)])
    );
  }

  const backgrounds = normalizeExtraBackgrounds(extras as ExtraBackground[]);
  return Object.fromEntries(
    backgrounds.flatMap((background) => [
      [
        buildLegacyExtraLabel(background.color, "sin_pisar"),
        background.priceSinPisar,
      ],
      [buildLegacyExtraLabel(background.color, "pisando"), background.pricePisando],
    ])
  );
};

export const getExtrasTotal = (
  extras: string[],
  backgrounds: ExtraBackground[]
) => {
  const resolvedExtras = resolveExtrasFromLabels(
    extras,
    backgrounds,
    MAX_EXTRA_BACKGROUNDS
  );
  const resolvedTotal = resolvedExtras.reduce(
    (total, extra) => total + extra.price,
    0
  );

  if (resolvedExtras.length === dedupeExtras(extras).length) {
    return resolvedTotal;
  }

  return dedupeExtras(extras).reduce(
    (total, extra) => total + getExtraPrice(extra, backgrounds),
    0
  );
};

export const formatExtraPriceLabel = (value: number) => formatLegacyPrice(value);

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

export type BookingSlotRange = {
  start: Date;
  end: Date;
};

export type BookingBasePricingBreakdown = {
  hours: number;
  baseSubtotal: number;
  weekendOrHolidayHours: number;
  nightHours: number;
  weekendOrHolidaySurcharge: number;
  nightSurcharge: number;
  surchargeSubtotal: number;
  totalBaseWithSurcharges: number;
};

export type BookingPricingBreakdown = BookingBasePricingBreakdown & {
  extrasTotal: number;
  servicesTotal: number;
  grandTotal: number;
};

type BookingPricingInput = {
  basePrice: number;
  slots: BookingSlotRange[];
  extrasTotal?: number;
  servicesTotal?: number;
  holidayDates?: Iterable<string>;
  fallbackHours?: number;
};

export const WEEKEND_OR_HOLIDAY_SURCHARGE_RATE = 0.3;
export const NIGHT_SURCHARGE_RATE = 0.4;
export const NIGHT_SURCHARGE_START_HOUR = 22;
export const NIGHT_SURCHARGE_END_HOUR = 8;

const ONE_HOUR_IN_MS = 60 * 60 * 1000;
const HOLIDAY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WEEKEND_WEEKDAYS = new Set(["sat", "sun"]);

const bookingDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BOOKING_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const bookingWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BOOKING_TIMEZONE,
  weekday: "short",
});

const bookingHourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BOOKING_TIMEZONE,
  hour: "2-digit",
  hour12: false,
});

const roundMoney = (value: number) => Math.round(value);
const roundHours = (value: number) => Math.round(value * 100) / 100;

const normalizeHolidayDate = (value: string) => {
  const normalized = value.trim();
  if (!normalized || !HOLIDAY_DATE_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
};

const buildHolidayDateSet = (dates?: Iterable<string>) =>
  new Set(
    Array.from(dates ?? []).flatMap((date) => {
      const normalized = normalizeHolidayDate(String(date || ""));
      return normalized ? [normalized] : [];
    })
  );

const parseHolidayDatesFromEnv = (value: string | undefined) =>
  value
    ?.split(/[,\s]+/g)
    .flatMap((item) => {
      const normalized = normalizeHolidayDate(item);
      return normalized ? [normalized] : [];
    }) ?? [];

const toHourStartDate = (value: Date) => new Date(value.getTime());

const getLocalDateKey = (value: Date) => bookingDateKeyFormatter.format(value);

const getLocalHour = (value: Date) => {
  const parsedHour = Number(bookingHourFormatter.format(value));
  if (!Number.isFinite(parsedHour)) {
    return 0;
  }
  return parsedHour === 24 ? 0 : parsedHour;
};

const isWeekendDate = (value: Date) =>
  WEEKEND_WEEKDAYS.has(bookingWeekdayFormatter.format(value).toLowerCase());

const isNightHour = (hour: number) =>
  hour >= NIGHT_SURCHARGE_START_HOUR || hour < NIGHT_SURCHARGE_END_HOUR;

const resolveFallbackHours = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
};

export const getConfiguredBookingHolidayDates = () => {
  return Array.from(new Set(parseHolidayDatesFromEnv(process.env.BOOKING_HOLIDAYS)));
};

export const calculateBookingPricing = ({
  basePrice,
  slots,
  extrasTotal = 0,
  servicesTotal = 0,
  holidayDates,
  fallbackHours = 0,
}: BookingPricingInput): BookingPricingBreakdown => {
  const safeBasePrice = resolveBasePrice(basePrice);
  const safeExtrasTotal = Number.isFinite(extrasTotal)
    ? Math.max(0, roundMoney(extrasTotal))
    : 0;
  const safeServicesTotal = Number.isFinite(servicesTotal)
    ? Math.max(0, roundMoney(servicesTotal))
    : 0;
  const configuredHolidayDates = buildHolidayDateSet(holidayDates);
  let baseSubtotalRaw = 0;
  let weekendOrHolidayHoursRaw = 0;
  let nightHoursRaw = 0;
  let weekendOrHolidaySurchargeRaw = 0;
  let nightSurchargeRaw = 0;
  let hoursRaw = 0;

  slots.forEach((slot) => {
    const startTime = slot.start.getTime();
    const endTime = slot.end.getTime();
    if (
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime) ||
      endTime <= startTime
    ) {
      return;
    }

    let cursor = startTime;

    while (cursor < endTime) {
      const nextCursor = Math.min(endTime, cursor + ONE_HOUR_IN_MS);
      const durationHours = (nextCursor - cursor) / ONE_HOUR_IN_MS;
      if (!Number.isFinite(durationHours) || durationHours <= 0) {
        cursor = nextCursor;
        continue;
      }

      const hourStart = toHourStartDate(new Date(cursor));
      const hourBaseAmount = safeBasePrice * durationHours;
      const isWeekend = isWeekendDate(hourStart);
      const isHoliday = configuredHolidayDates.has(getLocalDateKey(hourStart));
      const weekendOrHoliday = isWeekend || isHoliday;
      const night = isNightHour(getLocalHour(hourStart));

      hoursRaw += durationHours;
      baseSubtotalRaw += hourBaseAmount;

      if (weekendOrHoliday) {
        weekendOrHolidayHoursRaw += durationHours;
        weekendOrHolidaySurchargeRaw +=
          hourBaseAmount * WEEKEND_OR_HOLIDAY_SURCHARGE_RATE;
      }

      if (night) {
        nightHoursRaw += durationHours;
        nightSurchargeRaw += hourBaseAmount * NIGHT_SURCHARGE_RATE;
      }

      cursor = nextCursor;
    }
  });

  const normalizedFallbackHours = resolveFallbackHours(fallbackHours);
  const effectiveHours = hoursRaw > 0 ? hoursRaw : normalizedFallbackHours;
  const baseSubtotal =
    hoursRaw > 0 ? roundMoney(baseSubtotalRaw) : roundMoney(safeBasePrice * effectiveHours);
  const weekendOrHolidaySurcharge =
    hoursRaw > 0 ? roundMoney(weekendOrHolidaySurchargeRaw) : 0;
  const nightSurcharge = hoursRaw > 0 ? roundMoney(nightSurchargeRaw) : 0;
  const surchargeSubtotal = weekendOrHolidaySurcharge + nightSurcharge;
  const totalBaseWithSurcharges = baseSubtotal + surchargeSubtotal;

  return {
    hours: roundHours(effectiveHours),
    baseSubtotal,
    weekendOrHolidayHours: roundHours(weekendOrHolidayHoursRaw),
    nightHours: roundHours(nightHoursRaw),
    weekendOrHolidaySurcharge,
    nightSurcharge,
    surchargeSubtotal,
    totalBaseWithSurcharges,
    extrasTotal: safeExtrasTotal,
    servicesTotal: safeServicesTotal,
    grandTotal: totalBaseWithSurcharges + safeExtrasTotal + safeServicesTotal,
  };
};

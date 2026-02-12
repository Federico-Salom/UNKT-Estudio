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

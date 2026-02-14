import type { ServiceCatalog, ServiceOption } from "@/content/studio";

export type BookingServicesSelection = {
  photographyOptionId: string | null;
  modelsCount: number;
  makeupOptionId: string | null;
  hairstyleEnabled: boolean;
  stylingOptionId: string | null;
  artDirectionOptionId: string | null;
  lightOperatorEnabled: boolean;
  assistantsCount: number;
};

export type ServiceSubtotal = {
  key:
    | "photography"
    | "models"
    | "makeup"
    | "hairstyle"
    | "styling"
    | "art_direction"
    | "light_operator"
    | "assistants";
  label: string;
  description: string;
  amount: number;
};

export type ServicesBreakdown = {
  selection: BookingServicesSelection;
  subtotals: ServiceSubtotal[];
  total: number;
  errors: string[];
};

const DEFAULT_MAX_MODELS = 10;
const DEFAULT_MAX_ASSISTANTS = 10;
const DEFAULT_PHOTOGRAPHY_HINT =
  "Opcional. Si elegís una opción, las horas seleccionadas se usan como base de cálculo.";
const LEGACY_PHOTOGRAPHY_HINT_PATTERNS = [
  "obligatorio seleccionar una opcion",
];
const DEFAULT_PHOTOGRAPHY_OPTIONS: ServiceOption[] = [
  {
    id: "foto-15",
    label: "15 fotos finales editadas",
    price: 180000,
    minHours: 3,
  },
  {
    id: "foto-25",
    label: "25 fotos finales editadas",
    price: 280000,
    minHours: 4,
  },
  {
    id: "foto-35",
    label: "35 fotos finales editadas",
    price: 380000,
    minHours: 5,
  },
];
const SERVICE_COPY_BY_KEY = new Map<string, string>([
  ["servicios", "Servicios"],
  ["servicios unkt estudio", "Servicios UNKT Estudio"],
  ["elegi tu produccion fotografica", "Elegí tu producción fotográfica"],
  ["fotografia", "Fotografía"],
  ["modelos", "Modelos"],
  ["maquillaje", "Maquillaje"],
  ["peinado", "Peinado"],
  ["estilismo", "Estilismo"],
  ["direccion de arte", "Dirección de arte"],
  ["operador de luces", "Operador de luces"],
  ["asistentes de produccion", "Asistentes de producción"],
  ["total", "Total"],
  ["total servicios", "Total servicios"],
]);

const normalizeToken = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeText = (value: unknown, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const stripServicePrefixes = (value: string) =>
  value
    .replace(/^\s*paso\s*\d+\s*[-:.)]\s*/i, "")
    .replace(/^\s*\d+\s*[-:.)]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeServicePhraseKey = (value: string) =>
  stripServicePrefixes(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const isAllUppercaseText = (value: string) => {
  const lettersOnly = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/gi, "");
  if (!lettersOnly) {
    return false;
  }
  return lettersOnly === lettersOnly.toUpperCase();
};

const toSentenceCase = (value: string) =>
  value.toLowerCase().replace(/[a-z]/, (letter) => letter.toUpperCase());

const normalizeServiceCopy = (value: unknown, fallback = "") => {
  const raw = normalizeText(value, fallback);
  const stripped = stripServicePrefixes(raw);
  const safeText = stripped || fallback;

  const canonical = SERVICE_COPY_BY_KEY.get(normalizeServicePhraseKey(safeText));
  const cased = canonical || (isAllUppercaseText(safeText) ? toSentenceCase(safeText) : safeText);

  return cased.replace(/\bunkt\b/gi, "UNKT").trim();
};

const normalizePrice = (value: unknown, fallback: number) => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Math.max(0, Math.round(fallback));
  }
  return parsed;
};

const normalizeCount = (value: unknown, max: number) => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.min(parsed, max);
};

const normalizeMinHours = (value: unknown, fallback = 1) => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
};

const normalizeBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "si", "on"].includes(normalized);
  }
  if (typeof value === "number") {
    return value > 0;
  }
  return false;
};

export const normalizeServiceOptions = (
  options: ServiceOption[],
  prefix: string,
  fallbackLabel: string
): ServiceOption[] => {
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();

  const normalized = options.flatMap((option) => {
    const label = normalizeServiceCopy(option?.label);
    if (!label) {
      return [];
    }

    const labelKey = normalizeToken(label);
    if (!labelKey || seenLabels.has(labelKey)) {
      return [];
    }

    let baseId = normalizeToken(String(option?.id || ""));
    if (!baseId) {
      baseId = `${prefix}-${labelKey}`;
    }

    let id = baseId;
    let suffix = 2;
    while (seenIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }

    seenIds.add(id);
    seenLabels.add(labelKey);

    return [
      {
        id,
        label,
        price: normalizePrice(option?.price, 0),
        minHours:
          typeof option?.minHours === "number" || typeof option?.minHours === "string"
            ? normalizeMinHours(option.minHours)
            : undefined,
        description: normalizeServiceCopy(option?.description),
      },
    ];
  });

  if (normalized.length) {
    return normalized;
  }

  return [
    {
      id: `${prefix}-1`,
      label: fallbackLabel,
      price: 0,
      minHours: prefix === "photo" ? 1 : undefined,
    },
  ];
};

const ensurePhotographyDefaults = (options: ServiceOption[]) => {
  const byLabel = new Set(
    options.map((option) => normalizeServicePhraseKey(option.label))
  );
  const next = [...options];

  for (const fallbackOption of DEFAULT_PHOTOGRAPHY_OPTIONS) {
    const fallbackKey = normalizeServicePhraseKey(fallbackOption.label);
    if (!fallbackKey || byLabel.has(fallbackKey)) {
      continue;
    }

    next.push({ ...fallbackOption });
    byLabel.add(fallbackKey);
  }

  return next;
};

export const normalizeServiceCatalog = (catalog: ServiceCatalog): ServiceCatalog => {
  const safeMaxModels = Math.max(1, normalizeCount(catalog.maxModels, 50) || DEFAULT_MAX_MODELS);
  const safeMaxAssistants = Math.max(
    1,
    normalizeCount(catalog.maxAssistants, 50) || DEFAULT_MAX_ASSISTANTS
  );
  const rawPhotographyHint = normalizeText(catalog.photographyHint);
  const isLegacyPhotographyHint = LEGACY_PHOTOGRAPHY_HINT_PATTERNS.some((pattern) =>
    rawPhotographyHint.toLowerCase().includes(pattern)
  );
  const normalizedPhotographyHint =
    !rawPhotographyHint || isLegacyPhotographyHint
      ? DEFAULT_PHOTOGRAPHY_HINT
      : normalizeServiceCopy(rawPhotographyHint);

  const photographyOptions = ensurePhotographyDefaults(
    normalizeServiceOptions(
      catalog.photographyOptions,
      "photo",
      "Producción fotográfica"
    )
  ).map((option, index) => ({
    ...option,
    minHours: normalizeMinHours(option.minHours, index === 0 ? 2 : 1),
  }));

  return {
    ...catalog,
    title: normalizeServiceCopy(catalog.title, "Servicios"),
    subtitle: normalizeServiceCopy(catalog.subtitle, "Elegí tu producción fotográfica"),
    description: normalizeServiceCopy(catalog.description),
    bookingNotice: normalizeServiceCopy(catalog.bookingNotice),
    photographyTitle: normalizeServiceCopy(catalog.photographyTitle, "Fotografía"),
    photographyHint: normalizedPhotographyHint,
    photographyOptions,
    modelsTitle: normalizeServiceCopy(catalog.modelsTitle, "Modelos"),
    modelsHint: normalizeServiceCopy(catalog.modelsHint),
    maxModels: safeMaxModels,
    modelRatePerHour: normalizePrice(catalog.modelRatePerHour, 0),
    makeupTitle: normalizeServiceCopy(catalog.makeupTitle, "Maquillaje"),
    makeupHint: normalizeServiceCopy(catalog.makeupHint),
    makeupOptions: normalizeServiceOptions(
      catalog.makeupOptions,
      "makeup",
      "Maquillaje"
    ),
    hairstyleTitle: normalizeServiceCopy(catalog.hairstyleTitle, "Peinado"),
    hairstyleHint: normalizeServiceCopy(catalog.hairstyleHint),
    hairstyleLabel: normalizeServiceCopy(catalog.hairstyleLabel, "Peinado"),
    hairstyleRatePerModel: normalizePrice(catalog.hairstyleRatePerModel, 0),
    stylingTitle: normalizeServiceCopy(catalog.stylingTitle, "Estilismo"),
    stylingHint: normalizeServiceCopy(catalog.stylingHint),
    stylingOptions: normalizeServiceOptions(
      catalog.stylingOptions,
      "styling",
      "Servicio de estilismo"
    ),
    artDirectionTitle: normalizeServiceCopy(catalog.artDirectionTitle, "Dirección de arte"),
    artDirectionHint: normalizeServiceCopy(catalog.artDirectionHint),
    artDirectionOptions: normalizeServiceOptions(
      catalog.artDirectionOptions,
      "art",
      "Dirección de arte"
    ),
    lightOperatorTitle: normalizeServiceCopy(catalog.lightOperatorTitle, "Operador de luces"),
    lightOperatorHint: normalizeServiceCopy(catalog.lightOperatorHint),
    lightOperatorLabel: normalizeServiceCopy(
      catalog.lightOperatorLabel,
      "Disposición durante la jornada"
    ),
    lightOperatorRatePerHour: normalizePrice(catalog.lightOperatorRatePerHour, 0),
    assistantsTitle: normalizeServiceCopy(catalog.assistantsTitle, "Asistentes de producción"),
    assistantsHint: normalizeServiceCopy(catalog.assistantsHint),
    assistantsLabel: normalizeServiceCopy(
      catalog.assistantsLabel,
      "Disposición durante la jornada"
    ),
    maxAssistants: safeMaxAssistants,
    assistantsRatePerHour: normalizePrice(catalog.assistantsRatePerHour, 0),
    totalsTitle: normalizeServiceCopy(catalog.totalsTitle, "Total servicios"),
  };
};

const hasOptionId = (optionId: string | null, options: ServiceOption[]) => {
  if (!optionId) return false;
  return options.some((option) => option.id === optionId);
};

export const getDefaultServiceSelection = (
  _catalog: ServiceCatalog
): BookingServicesSelection => {
  void _catalog;
  return {
    photographyOptionId: null,
    modelsCount: 0,
    makeupOptionId: null,
    hairstyleEnabled: false,
    stylingOptionId: null,
    artDirectionOptionId: null,
    lightOperatorEnabled: false,
    assistantsCount: 0,
  };
};

export const getEmptyServiceSelection = (): BookingServicesSelection => ({
  photographyOptionId: null,
  modelsCount: 0,
  makeupOptionId: null,
  hairstyleEnabled: false,
  stylingOptionId: null,
  artDirectionOptionId: null,
  lightOperatorEnabled: false,
  assistantsCount: 0,
});

export const parseStoredServicesSelection = (
  rawValue: string,
  catalog: ServiceCatalog
): BookingServicesSelection => {
  const defaults = getEmptyServiceSelection();
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return defaults;
    }

    const payload = parsed as Partial<BookingServicesSelection>;
    const normalizedCatalog = normalizeServiceCatalog(catalog);

    const next: BookingServicesSelection = {
      photographyOptionId: normalizeText(payload.photographyOptionId) || null,
      modelsCount: normalizeCount(payload.modelsCount, normalizedCatalog.maxModels),
      makeupOptionId: normalizeText(payload.makeupOptionId) || null,
      hairstyleEnabled: normalizeBoolean(payload.hairstyleEnabled),
      stylingOptionId: normalizeText(payload.stylingOptionId) || null,
      artDirectionOptionId: normalizeText(payload.artDirectionOptionId) || null,
      lightOperatorEnabled: normalizeBoolean(payload.lightOperatorEnabled),
      assistantsCount: normalizeCount(
        payload.assistantsCount,
        normalizedCatalog.maxAssistants
      ),
    };

    if (!hasOptionId(next.photographyOptionId, normalizedCatalog.photographyOptions)) {
      next.photographyOptionId = null;
    }
    if (!hasOptionId(next.makeupOptionId, normalizedCatalog.makeupOptions)) {
      next.makeupOptionId = null;
    }
    if (!hasOptionId(next.stylingOptionId, normalizedCatalog.stylingOptions)) {
      next.stylingOptionId = null;
    }
    if (!hasOptionId(next.artDirectionOptionId, normalizedCatalog.artDirectionOptions)) {
      next.artDirectionOptionId = null;
    }

    return next;
  } catch {
    return defaults;
  }
};

export const normalizeBookingServicesSelection = (
  rawValue: unknown,
  catalog: ServiceCatalog
): BookingServicesSelection => {
  const defaults = getEmptyServiceSelection();
  const normalizedCatalog = normalizeServiceCatalog(catalog);

  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return defaults;
  }

  const payload = rawValue as Partial<BookingServicesSelection>;
  const next: BookingServicesSelection = {
    photographyOptionId: normalizeText(payload.photographyOptionId) || null,
    modelsCount: normalizeCount(payload.modelsCount, normalizedCatalog.maxModels),
    makeupOptionId: normalizeText(payload.makeupOptionId) || null,
    hairstyleEnabled: normalizeBoolean(payload.hairstyleEnabled),
    stylingOptionId: normalizeText(payload.stylingOptionId) || null,
    artDirectionOptionId: normalizeText(payload.artDirectionOptionId) || null,
    lightOperatorEnabled: normalizeBoolean(payload.lightOperatorEnabled),
    assistantsCount: normalizeCount(payload.assistantsCount, normalizedCatalog.maxAssistants),
  };

  if (!hasOptionId(next.photographyOptionId, normalizedCatalog.photographyOptions)) {
    next.photographyOptionId = null;
  }
  if (!hasOptionId(next.makeupOptionId, normalizedCatalog.makeupOptions)) {
    next.makeupOptionId = null;
  }
  if (!hasOptionId(next.stylingOptionId, normalizedCatalog.stylingOptions)) {
    next.stylingOptionId = null;
  }
  if (!hasOptionId(next.artDirectionOptionId, normalizedCatalog.artDirectionOptions)) {
    next.artDirectionOptionId = null;
  }

  return next;
};

const formatMoney = (value: number) => `$${Math.round(value).toLocaleString("es-AR")}`;

const getOptionById = (options: ServiceOption[], optionId: string | null) => {
  if (!optionId) return null;
  return options.find((option) => option.id === optionId) || null;
};

export const getServicesBreakdown = ({
  selection,
  catalog,
  hours,
}: {
  selection: BookingServicesSelection;
  catalog: ServiceCatalog;
  hours: number;
}): ServicesBreakdown => {
  const normalizedCatalog = normalizeServiceCatalog(catalog);
  const safeHours = Math.max(0, Math.round(hours));
  const normalizedSelection = normalizeBookingServicesSelection(
    selection,
    normalizedCatalog
  );

  const photographyOption = getOptionById(
    normalizedCatalog.photographyOptions,
    normalizedSelection.photographyOptionId
  );
  const makeupOption = getOptionById(
    normalizedCatalog.makeupOptions,
    normalizedSelection.makeupOptionId
  );
  const stylingOption = getOptionById(
    normalizedCatalog.stylingOptions,
    normalizedSelection.stylingOptionId
  );
  const artDirectionOption = getOptionById(
    normalizedCatalog.artDirectionOptions,
    normalizedSelection.artDirectionOptionId
  );

  const errors: string[] = [];

  if (
    photographyOption?.minHours &&
    safeHours > 0 &&
    safeHours < photographyOption.minHours
  ) {
    errors.push(
      `${photographyOption.label} requiere mínimo ${photographyOption.minHours} horas.`
    );
  }

  const photographyAmount = photographyOption?.price ?? 0;
  const modelsAmount =
    normalizedSelection.modelsCount * safeHours * normalizedCatalog.modelRatePerHour;
  const makeupAmount = makeupOption
    ? normalizedSelection.modelsCount * makeupOption.price
    : 0;
  const hairstyleAmount = normalizedSelection.hairstyleEnabled
    ? normalizedSelection.modelsCount * normalizedCatalog.hairstyleRatePerModel
    : 0;
  const stylingAmount = stylingOption?.price ?? 0;
  const artDirectionAmount = artDirectionOption?.price ?? 0;
  const lightOperatorAmount = normalizedSelection.lightOperatorEnabled
    ? safeHours * normalizedCatalog.lightOperatorRatePerHour
    : 0;
  const assistantsAmount =
    normalizedSelection.assistantsCount *
    safeHours *
    normalizedCatalog.assistantsRatePerHour;

  const subtotals: ServiceSubtotal[] = [
    {
      key: "photography",
      label: normalizedCatalog.photographyTitle,
      description: photographyOption
        ? `${photographyOption.label}${
            photographyOption.minHours
              ? ` (mínimo ${photographyOption.minHours} horas)`
              : ""
          }`
        : "Sin fotografía",
      amount: photographyAmount,
    },
    {
      key: "models",
      label: normalizedCatalog.modelsTitle,
      description:
        normalizedSelection.modelsCount > 0
          ? `${normalizedSelection.modelsCount} x ${safeHours} horas x ${formatMoney(
              normalizedCatalog.modelRatePerHour
            )}`
          : "Sin modelos",
      amount: modelsAmount,
    },
    {
      key: "makeup",
      label: normalizedCatalog.makeupTitle,
      description: makeupOption
        ? `${makeupOption.label} x ${normalizedSelection.modelsCount} modelo(s)`
        : "Sin maquillaje",
      amount: makeupAmount,
    },
    {
      key: "hairstyle",
      label: normalizedCatalog.hairstyleTitle,
      description: normalizedSelection.hairstyleEnabled
        ? `${normalizedCatalog.hairstyleLabel} x ${normalizedSelection.modelsCount} modelo(s)`
        : "Sin peinado",
      amount: hairstyleAmount,
    },
    {
      key: "styling",
      label: normalizedCatalog.stylingTitle,
      description: stylingOption?.label || "Sin estilismo",
      amount: stylingAmount,
    },
    {
      key: "art_direction",
      label: normalizedCatalog.artDirectionTitle,
      description: artDirectionOption?.label || "Sin dirección de arte",
      amount: artDirectionAmount,
    },
    {
      key: "light_operator",
      label: normalizedCatalog.lightOperatorTitle,
      description: normalizedSelection.lightOperatorEnabled
        ? `${safeHours} horas x ${formatMoney(normalizedCatalog.lightOperatorRatePerHour)}`
        : "Sin operador de luces",
      amount: lightOperatorAmount,
    },
    {
      key: "assistants",
      label: normalizedCatalog.assistantsTitle,
      description:
        normalizedSelection.assistantsCount > 0
          ? `${normalizedSelection.assistantsCount} x ${safeHours} horas x ${formatMoney(
              normalizedCatalog.assistantsRatePerHour
            )}`
          : "Sin asistentes",
      amount: assistantsAmount,
    },
  ];

  const total = subtotals.reduce((acc, item) => acc + item.amount, 0);

  return {
    selection: normalizedSelection,
    subtotals,
    total,
    errors,
  };
};

export const getServicesTotal = ({
  selection,
  catalog,
  hours,
}: {
  selection: BookingServicesSelection;
  catalog: ServiceCatalog;
  hours: number;
}) => getServicesBreakdown({ selection, catalog, hours }).total;

export const getServicesSummaryLines = ({
  selection,
  catalog,
  hours,
}: {
  selection: BookingServicesSelection;
  catalog: ServiceCatalog;
  hours: number;
}) => {
  const breakdown = getServicesBreakdown({ selection, catalog, hours });

  return breakdown.subtotals
    .filter((item) => item.amount > 0)
    .map((item) => ({
      label: `${item.label}: ${item.description}`,
      amount: item.amount,
    }));
};

export const stringifyServicesSelection = (
  selection: BookingServicesSelection,
  catalog: ServiceCatalog
) => JSON.stringify(normalizeBookingServicesSelection(selection, catalog));

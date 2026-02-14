import { prisma } from "@/lib/prisma";
import { studio } from "@/content/studio";
import type { StudioContent } from "@/content/studio";
import {
  normalizeExtraBackgrounds,
  resolveExtraMaxSelections,
} from "@/lib/booking";
import { normalizeServiceCatalog } from "@/lib/services";

const DEFAULT_ID = "main";
const LEGACY_LOGO_SRC = "/logo.svg";
const DEFAULT_LOGO_SRC = "/logo.jpg";
const DEFAULT_WORDMARK_SRC = "/logo-largo.svg";
const DEFAULT_FLOOR_PLAN_SRC = "/plano-estudio.svg";
const DEFAULT_FLOOR_PLAN_ALT = "Plano del lugar";
const DEFAULT_GALLERY = (() => {
  const validItems = studio.gallery
    .filter((item) => Boolean(item.src?.trim()))
    .map((item) => ({
      src: item.src,
      alt: item.alt || "Vista del estudio.",
    }));

  if (!validItems.length) {
    validItems.push({
      src: "/gallery-1.svg",
      alt: "Área principal del estudio.",
    });
  }

  if (validItems.length === 1) {
    validItems.push({
      src: "/hero-placeholder.svg",
      alt: "Set secundario del estudio.",
    });
  }

  return validItems.slice(0, 10);
})();
const LEGACY_GALLERY_PLACEHOLDERS = new Set([
  "/gallery-2.svg",
  "/gallery-3.svg",
  "/gallery-4.svg",
  "/gallery-5.svg",
  "/gallery-6.svg",
]);
const LEGACY_LOCATION_TEXT_PLACEHOLDERS = new Set([
  "(sumar direccion)",
  "(sumar dirección)",
]);
const LEGACY_LOCATION_URLS = new Set([
  "https://maps.google.com/?q=unkt+estudio",
  "https://maps.google.com/?q=unkt%2bestudio",
]);
const LEGACY_EXTRA_ITEMS = ["Sillón", "Accesorios de acero"];
const LEGACY_INCLUDED_DEFAULT_ITEMS = [
  "Luces",
  "Difusores",
  "Fondos",
  "Sillon",
  "Accesorios de acero",
];
const MIGRATED_INCLUDED_ITEMS_FROM_LEGACY_EXTRAS = [
  "Sillón Chesterfield",
  "Espacio de acero",
];
const normalizeListValue = (value: string) => value.trim().toLowerCase();
const normalizeLegacyListValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const dedupeList = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeListValue(item);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};
const REQUIRED_BOOKING_POLICIES = [
  "Sábados, domingos y feriados tienen un recargo del 30% sobre la tarifa por hora.",
  "La franja nocturna (de 22:00 a 08:00) tiene un recargo del 40% sobre la tarifa por hora.",
  "Hora extra: $70.000 por hora (equipo base). Servicios adicionales se prorratean.",
  "Entrega digital dentro de X días hábiles.",
] as const;
const ensureRequiredBookingPolicies = (items: string[]) => {
  const seen = new Set(items.map(normalizeListValue));
  const nextItems = [...items];

  for (const condition of REQUIRED_BOOKING_POLICIES) {
    const normalizedCondition = normalizeListValue(condition);
    if (!normalizedCondition || seen.has(normalizedCondition)) {
      continue;
    }
    seen.add(normalizedCondition);
    nextItems.push(condition);
  }

  return nextItems;
};
const hasAnyLegacyExtra = (items: string[]) => {
  const normalizedItems = new Set(items.map(normalizeLegacyListValue));
  return LEGACY_EXTRA_ITEMS.some((item) =>
    normalizedItems.has(normalizeLegacyListValue(item))
  );
};
const hasLegacyIncludedDefaults = (items: string[]) => {
  const normalizedItems = Array.from(
    new Set(items.map(normalizeLegacyListValue).filter(Boolean))
  );
  const normalizedLegacyDefaults = Array.from(
    new Set(
      LEGACY_INCLUDED_DEFAULT_ITEMS.map(normalizeLegacyListValue).filter(Boolean)
    )
  );

  if (normalizedItems.length !== normalizedLegacyDefaults.length) {
    return false;
  }

  const normalizedLegacySet = new Set(normalizedLegacyDefaults);
  return normalizedItems.every((item) => normalizedLegacySet.has(item));
};
const buildCatalogImageAlt = (label: string) => `Imagen de ${label}`;
const normalizeCatalogImages = (
  items: string[],
  images: StudioContent["included"]["images"]
) =>
  items.map((item, index) => {
    const source = images[index];
    const alt =
      typeof source?.alt === "string" && source.alt.trim()
        ? source.alt
        : buildCatalogImageAlt(item);

    return {
      src: source?.src || "",
      alt,
    };
  });

const parseLegacyPrice = (value: string) => {
  const moneyMatch = value.match(/\$\s*([\d.,]+)/);
  if (moneyMatch?.[1]) {
    const normalized = moneyMatch[1].replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }

  const thousandMatch = value.match(/(\d+(?:[.,]\d+)?)\s*mil/i);
  if (thousandMatch?.[1]) {
    const normalized = thousandMatch[1].replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed * 1000);
    }
  }

  return null;
};

const resolveLegacyModePrice = (
  items: string[],
  mode: "sin_pisar" | "pisando"
) => {
  const normalizedModeItems = items.filter((item) => {
    const normalized = normalizeListValue(item);
    if (mode === "sin_pisar") {
      return normalized.includes("sin pisar");
    }
    return normalized.includes("pisando") && !normalized.includes("sin pisar");
  });

  for (const item of normalizedModeItems) {
    const parsed = parseLegacyPrice(item);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
};

const resolveExtrasBackgrounds = (content: StudioContent) => {
  const legacyItems = dedupeList(
    content.extras.items
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  );
  const normalizedBackgrounds = normalizeExtraBackgrounds(content.extras.backgrounds);
  const usableBackgrounds = normalizedBackgrounds.length
    ? normalizedBackgrounds
    : normalizeExtraBackgrounds(studio.extras.backgrounds);

  const colorItems = dedupeList(
    legacyItems.filter((item) => {
      const normalized = normalizeListValue(item);
      return !normalized.includes("pisando") && !normalized.includes("sin pisar");
    })
  );

  const legacySinPisarPrice = resolveLegacyModePrice(legacyItems, "sin_pisar");
  const legacyPisandoPrice = resolveLegacyModePrice(legacyItems, "pisando");

  const mappedBackgrounds = (colorItems.length ? colorItems : usableBackgrounds.map((item) => item.color)).map(
    (color, index) => {
      const byColor = usableBackgrounds.find(
        (background) => normalizeListValue(background.color) === normalizeListValue(color)
      );
      const byIndex = usableBackgrounds[index];
      const source = byColor || byIndex;

      return {
        id: source?.id || `fondo-${index + 1}`,
        color,
        priceSinPisar:
          source?.priceSinPisar ??
          legacySinPisarPrice ??
          studio.extras.backgrounds[0]?.priceSinPisar ??
          0,
        pricePisando:
          source?.pricePisando ??
          legacyPisandoPrice ??
          studio.extras.backgrounds[0]?.pricePisando ??
          0,
      };
    }
  );

  return normalizeExtraBackgrounds(mappedBackgrounds);
};

const serializeContent = (data: StudioContent) => {
  return JSON.stringify(data);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
};

const mergeWithDefaults = <T>(
  defaults: T,
  value: unknown
): T => {
  if (Array.isArray(defaults)) {
    return (Array.isArray(value) ? value : defaults) as T;
  }

  if (isPlainObject(defaults)) {
    const source = isPlainObject(value) ? value : {};
    const merged: Record<string, unknown> = {};

    for (const [key, defaultValue] of Object.entries(defaults)) {
      merged[key] = mergeWithDefaults(defaultValue, source[key]);
    }

    // Preserve unknown keys that may be added in future custom content.
    for (const [key, sourceValue] of Object.entries(source)) {
      if (!(key in merged)) {
        merged[key] = sourceValue;
      }
    }

    return merged as T;
  }

  return (value === undefined || value === null ? defaults : value) as T;
};

const parseContent = (data: string): StudioContent => {
  try {
    const parsed = JSON.parse(data) as unknown;
    return normalizeAssetPaths(mergeWithDefaults(studio, parsed));
  } catch {
    return normalizeAssetPaths(studio);
  }
};

const normalizeAssetPaths = (content: StudioContent): StudioContent => {
  const normalizedLogoSrc =
    content.logo.src === LEGACY_LOGO_SRC ? DEFAULT_LOGO_SRC : content.logo.src;
  const normalizedOgImage =
    content.seo.ogImage === LEGACY_LOGO_SRC
      ? DEFAULT_LOGO_SRC
      : content.seo.ogImage;
  const fallbackGalleryItem = DEFAULT_GALLERY[0];
  const normalizedGallery = content.gallery
    .map((item) => {
      const normalizedSrc = LEGACY_GALLERY_PLACEHOLDERS.has(item.src)
        ? fallbackGalleryItem.src
        : item.src;
      return {
        ...item,
        src: normalizedSrc || fallbackGalleryItem.src,
        alt: item.alt || fallbackGalleryItem.alt,
      };
    })
    .filter((item) => Boolean(item.src?.trim()));
  const hasLegacySingleDefaultGallery =
    normalizedGallery.length === 1 &&
    normalizedGallery[0].src === DEFAULT_GALLERY[0].src &&
    normalizedGallery[0].alt === DEFAULT_GALLERY[0].alt;
  const gallery =
    normalizedGallery.length === 0 || hasLegacySingleDefaultGallery
      ? DEFAULT_GALLERY
      : normalizedGallery;
  const normalizedLocationTextCandidate = content.contact.locationText.trim();
  const normalizedLocationText = LEGACY_LOCATION_TEXT_PLACEHOLDERS.has(
    normalizeListValue(normalizedLocationTextCandidate)
  )
    ? ""
    : normalizedLocationTextCandidate;
  const normalizedLocationUrlCandidate = content.contact.locationUrl.trim();
  const normalizedLocationUrl = LEGACY_LOCATION_URLS.has(
    normalizeListValue(normalizedLocationUrlCandidate)
  )
    ? ""
    : normalizedLocationUrlCandidate;
  const normalizedContact: StudioContent["contact"] = {
    whatsapp: {
      phone: content.contact.whatsapp.phone || studio.contact.whatsapp.phone,
      message:
        content.contact.whatsapp.message || studio.contact.whatsapp.message,
    },
    instagram: content.contact.instagram || "",
    email: content.contact.email || studio.contact.email,
    locationText: normalizedLocationText,
    locationUrl: normalizedLocationUrl,
  };
  const normalizedExtrasBackgrounds = resolveExtrasBackgrounds(content);
  const normalizedExtraItems = normalizedExtrasBackgrounds.map(
    (background) => background.color
  );

  const normalizedContent = {
    ...content,
    logo: {
      ...content.logo,
      src: normalizedLogoSrc || DEFAULT_LOGO_SRC,
      wordmarkSrc: content.logo.wordmarkSrc || DEFAULT_WORDMARK_SRC,
    },
    seo: {
      ...content.seo,
      ogImage: normalizedOgImage || normalizedLogoSrc || DEFAULT_LOGO_SRC,
    },
    floorPlan: {
      ...content.floorPlan,
      src: content.floorPlan.src || DEFAULT_FLOOR_PLAN_SRC,
      alt: content.floorPlan.alt || DEFAULT_FLOOR_PLAN_ALT,
    },
    contact: normalizedContact,
    included: {
      ...content.included,
      items: [...content.included.items],
      images: normalizeCatalogImages(
        content.included.items,
        content.included.images
      ),
    },
    extras: {
      ...content.extras,
      maxSelections: resolveExtraMaxSelections(content.extras.maxSelections),
      items: normalizedExtraItems,
      backgrounds: normalizedExtrasBackgrounds,
      images: normalizeCatalogImages(normalizedExtraItems, content.extras.images),
    },
    services: normalizeServiceCatalog(content.services),
    footer: {
      ...content.footer,
      policies: {
        ...content.footer.policies,
        cancellation: [...content.footer.policies.cancellation],
        booking: ensureRequiredBookingPolicies([
          ...content.footer.policies.booking,
        ]),
      },
    },
    gallery,
  };

  const shouldMigrateLegacyIncludedDefaults = hasLegacyIncludedDefaults(
    normalizedContent.included.items
  );
  const shouldMigrateLegacyExtras = hasAnyLegacyExtra(normalizedContent.extras.items);

  if (!shouldMigrateLegacyIncludedDefaults && !shouldMigrateLegacyExtras) {
    return normalizedContent;
  }

  const migratedIncludedItems = dedupeList([
    ...(shouldMigrateLegacyIncludedDefaults
      ? studio.included.items
      : normalizedContent.included.items),
    ...(shouldMigrateLegacyExtras
      ? MIGRATED_INCLUDED_ITEMS_FROM_LEGACY_EXTRAS
      : []),
  ]);

  const migratedContent: StudioContent = {
    ...normalizedContent,
    included: {
      ...normalizedContent.included,
      items: migratedIncludedItems,
      images: normalizeCatalogImages(
        migratedIncludedItems,
        normalizedContent.included.images
      ),
    },
  };

  if (!shouldMigrateLegacyExtras) {
    return migratedContent;
  }

  return {
    ...migratedContent,
    extras: {
      ...normalizedContent.extras,
      title: studio.extras.title,
      subtitle: studio.extras.subtitle,
      maxSelections: resolveExtraMaxSelections(studio.extras.maxSelections),
      items: [...studio.extras.items],
      backgrounds: normalizeExtraBackgrounds(studio.extras.backgrounds),
      images: normalizeCatalogImages(studio.extras.items, studio.extras.images),
    },
  };
};

export const getStudioContent = async (): Promise<StudioContent> => {
  const fallbackContent = normalizeAssetPaths(studio);

  try {
    const existing = await prisma.siteContent.findUnique({
      where: { id: DEFAULT_ID },
      select: { data: true },
    });

    if (existing?.data) {
      return parseContent(existing.data);
    }

    try {
      const created = await prisma.siteContent.create({
        data: {
          id: DEFAULT_ID,
          data: serializeContent(studio),
        },
        select: { data: true },
      });

      return parseContent(created.data);
    } catch {
      const raceRecovered = await prisma.siteContent
        .findUnique({
          where: { id: DEFAULT_ID },
          select: { data: true },
        })
        .catch(() => null);

      if (raceRecovered?.data) {
        return parseContent(raceRecovered.data);
      }

      return fallbackContent;
    }
  } catch {
    return fallbackContent;
  }
};

export const updateStudioContent = async (
  nextContent: StudioContent
): Promise<StudioContent> => {
  const updated = await prisma.siteContent.upsert({
    where: { id: DEFAULT_ID },
    create: {
      id: DEFAULT_ID,
      data: serializeContent(nextContent),
    },
    update: {
      data: serializeContent(nextContent),
    },
  });

  return parseContent(updated.data);
};


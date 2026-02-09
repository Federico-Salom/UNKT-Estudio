import { prisma } from "@/lib/prisma";
import { studio } from "@/content/studio";
import type { StudioContent } from "@/content/studio";

const DEFAULT_ID = "main";
const LEGACY_LOGO_SRC = "/logo.svg";
const DEFAULT_LOGO_SRC = "/logo.jpg";
const DEFAULT_WORDMARK_SRC = "/logo-largo.svg";

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

  return {
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
  };
};

export const getStudioContent = async (): Promise<StudioContent> => {
  const record = await prisma.siteContent.upsert({
    where: { id: DEFAULT_ID },
    create: {
      id: DEFAULT_ID,
      data: serializeContent(studio),
    },
    update: {},
  });

  return parseContent(record.data);
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

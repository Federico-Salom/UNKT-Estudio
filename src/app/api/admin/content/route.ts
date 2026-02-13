import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getSessionFromCookies } from "@/lib/auth";
import { normalizeExtraBackgrounds, resolveExtraMaxSelections } from "@/lib/booking";
import { normalizeServiceCatalog } from "@/lib/services";
import { prisma } from "@/lib/prisma";
import { getStudioContent, updateStudioContent } from "@/lib/studio-content";
import { studio } from "@/content/studio";
import type { StudioContent } from "@/content/studio";

export const runtime = "nodejs";

const getBaseUrl = (request: NextRequest) => {
  const parsed = new URL(request.url);
  const host = request.headers.get("host") || parsed.host;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isLocal = host.includes("localhost") || host.startsWith("127.0.0.1");
  const protocol = isLocal
    ? "http"
    : forwardedProto || parsed.protocol.replace(":", "");
  return `${protocol}://${host}`;
};

const toText = (value: FormDataEntryValue | null) =>
  String(value ?? "").trim();

const normalizeSiteUrl = (value: string, fallback: string) => {
  const candidate = value.trim();
  if (!candidate) return fallback;
  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
};

const parseList = (value: FormDataEntryValue | null, fallback: string[]) => {
  const lines = String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines : fallback;
};

const normalizeColorKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeServiceKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const clampExtraColors = (items: string[], fallback: string[]) => {
  const source = items.length ? items : fallback;
  const seen = new Set<string>();
  const colors: string[] = [];

  for (const item of source) {
    const color = item.trim();
    const key = normalizeColorKey(color);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    colors.push(color);
    if (colors.length >= 5) {
      break;
    }
  }

  return colors;
};

const buildExtraBackgroundsFromColors = ({
  colors,
  currentBackgrounds,
}: {
  colors: string[];
  currentBackgrounds: StudioContent["extras"]["backgrounds"];
}) => {
  const normalizedCurrent = normalizeExtraBackgrounds(currentBackgrounds);
  const byColor = new Map(
    normalizedCurrent.map((background) => [normalizeColorKey(background.color), background])
  );

  return normalizeExtraBackgrounds(
    colors.map((color, index) => {
      const bySameColor = byColor.get(normalizeColorKey(color));
      const byIndex = normalizedCurrent[index];
      const source = bySameColor || byIndex || studio.extras.backgrounds[index];

      return {
        id: source?.id || `fondo-${index + 1}`,
        color,
        priceSinPisar:
          source?.priceSinPisar ??
          studio.extras.backgrounds[0]?.priceSinPisar ??
          0,
        pricePisando:
          source?.pricePisando ??
          studio.extras.backgrounds[0]?.pricePisando ??
          0,
      };
    })
  );
};

const buildServiceOptionsFromLines = ({
  lines,
  currentOptions,
  fallbackOptions,
  allowMinHours,
}: {
  lines: string[];
  currentOptions: StudioContent["services"]["photographyOptions"];
  fallbackOptions: StudioContent["services"]["photographyOptions"];
  allowMinHours?: boolean;
}) => {
  const byCurrentLabel = new Map(
    currentOptions.map((option) => [normalizeServiceKey(option.label), option])
  );
  const byFallbackLabel = new Map(
    fallbackOptions.map((option) => [normalizeServiceKey(option.label), option])
  );
  const seen = new Set<string>();

  return lines.flatMap((line, index) => {
    const [labelRaw, minHoursRaw] = line.split("|");
    const label = String(labelRaw ?? "").trim();
    const key = normalizeServiceKey(label);
    if (!key || seen.has(key)) {
      return [];
    }
    seen.add(key);

    const currentByIndex = currentOptions[index];
    const fallbackByIndex = fallbackOptions[index];
    const source =
      byCurrentLabel.get(key) ||
      byFallbackLabel.get(key) ||
      currentByIndex ||
      fallbackByIndex ||
      fallbackOptions[0];

    const parsedMinHours = Math.round(Number(minHoursRaw?.trim() ?? ""));
    const minHours = allowMinHours
      ? Number.isFinite(parsedMinHours) && parsedMinHours > 0
        ? parsedMinHours
        : source?.minHours || 1
      : undefined;

    return [
      {
        id: source?.id || `${key}-${index + 1}`,
        label,
        price: source?.price ?? 0,
        minHours,
        description: source?.description || "",
      },
    ];
  });
};

const stripLegacyContentFields = (content: StudioContent) => {
  const mutable = content as StudioContent & Record<string, unknown>;
  const ctas = mutable.ctas;
  const footer = mutable.footer;

  if (ctas && typeof ctas === "object" && !Array.isArray(ctas)) {
    delete (ctas as Record<string, unknown>).secondary;
  }

  if (footer && typeof footer === "object" && !Array.isArray(footer)) {
    delete (footer as Record<string, unknown>).text;
  }

  delete mutable.howToBook;
};

const getFile = (value: FormDataEntryValue | null) => {
  if (!value || typeof value === "string") return null;
  return value.size > 0 ? value : null;
};

const saveUpload = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "");
  const filename = `${Date.now()}-${safeName || "upload"}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/${filename}`;
};

type CatalogImagePayload = {
  id: string;
  src?: string;
  alt?: string;
};

const buildCatalogImageAlt = (label: string) => `Imagen de ${label}`;

const parseCatalogImageOrder = (
  value: FormDataEntryValue | null
): CatalogImagePayload[] | null => {
  if (value === null) return null;

  try {
    const parsed = JSON.parse(String(value)) as unknown;
    if (!Array.isArray(parsed)) return null;

    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const payload = item as {
        id?: unknown;
        src?: unknown;
        alt?: unknown;
      };
      const id = String(payload.id ?? "").trim();
      if (!id) return [];

      return [
        {
          id,
          src: typeof payload.src === "string" ? payload.src : "",
          alt: typeof payload.alt === "string" ? payload.alt : "",
        },
      ];
    });
  } catch {
    return null;
  }
};

const buildCatalogImages = async ({
  orderRaw,
  filePrefix,
  labels,
  currentImages,
  formData,
}: {
  orderRaw: FormDataEntryValue | null;
  filePrefix: string;
  labels: string[];
  currentImages: StudioContent["included"]["images"];
  formData: FormData;
}) => {
  const fallbackOrder = labels.map((_, index) => ({
    id: `fallback-${index}`,
    src: currentImages[index]?.src || "",
    alt: currentImages[index]?.alt || "",
  }));
  const parsedOrder = parseCatalogImageOrder(orderRaw);
  const sourceOrder = parsedOrder?.length ? parsedOrder : fallbackOrder;
  const nextImages: StudioContent["included"]["images"] = [];

  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index];
    const sourceItem = sourceOrder[index];
    const fallbackItem = fallbackOrder[index];
    const id = sourceItem?.id || fallbackItem.id;
    let src =
      (typeof sourceItem?.src === "string" ? sourceItem.src : "") ||
      fallbackItem.src;
    const alt =
      (typeof sourceItem?.alt === "string" ? sourceItem.alt.trim() : "") ||
      fallbackItem.alt ||
      buildCatalogImageAlt(label);

    const file = id ? getFile(formData.get(`${filePrefix}${id}`)) : null;
    if (file) {
      src = await saveUpload(file);
    }

    nextImages.push({
      src,
      alt,
    });
  }

  return nextImages;
};

export async function POST(request: NextRequest) {
  const wantsJson = request.headers
    .get("accept")
    ?.toLowerCase()
    .includes("application/json");

  const session = await getSessionFromCookies();
  if (!session) {
    if (wantsJson) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", getBaseUrl(request)));
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user || user.role !== "admin") {
    if (wantsJson) {
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/admin", getBaseUrl(request)));
  }

  const current = await getStudioContent();
  const formData = await request.formData();

  const nextContent: StudioContent = JSON.parse(
    JSON.stringify(current)
  ) as StudioContent;

  nextContent.name = toText(formData.get("name")) || current.name;
  nextContent.siteUrl = normalizeSiteUrl(
    toText(formData.get("siteUrl")),
    current.siteUrl || studio.siteUrl
  );
  nextContent.logo.src = current.logo.src;
  nextContent.logo.wordmarkSrc = current.logo.wordmarkSrc;
  nextContent.logo.alt = toText(formData.get("logoAlt")) || current.logo.alt;
  nextContent.seo.title = toText(formData.get("seoTitle")) || current.seo.title;
  nextContent.seo.description =
    toText(formData.get("seoDescription")) || current.seo.description;
  nextContent.seo.ogImage = current.seo.ogImage;
  nextContent.hero.title =
    toText(formData.get("heroTitle")) || current.hero.title;
  nextContent.hero.subtitle =
    toText(formData.get("heroSubtitle")) || current.hero.subtitle;
  nextContent.contact.whatsapp.phone =
    toText(formData.get("whatsappPhone")) || current.contact.whatsapp.phone;
  nextContent.contact.whatsapp.message =
    toText(formData.get("whatsappMessage")) ||
    current.contact.whatsapp.message;
  nextContent.contact.instagram =
    toText(formData.get("contactInstagram"));
  nextContent.contact.email =
    toText(formData.get("contactEmail")) || current.contact.email;
  nextContent.contact.locationText =
    toText(formData.get("locationText"));
  nextContent.contact.locationUrl =
    toText(formData.get("locationUrl"));
  nextContent.contact = {
    whatsapp: {
      phone: nextContent.contact.whatsapp.phone,
      message: nextContent.contact.whatsapp.message,
    },
    instagram: nextContent.contact.instagram,
    email: nextContent.contact.email,
    locationText: nextContent.contact.locationText,
    locationUrl: nextContent.contact.locationUrl,
  };
  nextContent.footer.policies.cancellation = parseList(
    formData.get("footerPoliciesCancellation"),
    current.footer.policies.cancellation
  );
  nextContent.footer.policies.booking = parseList(
    formData.get("footerPoliciesBooking"),
    current.footer.policies.booking
  );

  nextContent.included.title =
    toText(formData.get("includedTitle")) || current.included.title;
  nextContent.included.subtitle =
    toText(formData.get("includedSubtitle")) || current.included.subtitle;
  nextContent.extras.title =
    toText(formData.get("extrasTitle")) || current.extras.title;
  nextContent.extras.subtitle =
    toText(formData.get("extrasSubtitle")) || current.extras.subtitle;
  const currentServices = normalizeServiceCatalog(current.services);

  nextContent.services.title =
    toText(formData.get("servicesTitle")) || currentServices.title;
  nextContent.services.subtitle =
    toText(formData.get("servicesSubtitle")) || currentServices.subtitle;
  nextContent.services.description =
    toText(formData.get("servicesDescription")) || currentServices.description;
  nextContent.services.bookingNotice =
    toText(formData.get("servicesBookingNotice")) || currentServices.bookingNotice;
  nextContent.services.photographyTitle =
    toText(formData.get("servicesPhotographyTitle")) ||
    currentServices.photographyTitle;
  nextContent.services.photographyHint =
    toText(formData.get("servicesPhotographyHint")) || currentServices.photographyHint;
  nextContent.services.modelsTitle =
    toText(formData.get("servicesModelsTitle")) || currentServices.modelsTitle;
  nextContent.services.modelsHint =
    toText(formData.get("servicesModelsHint")) || currentServices.modelsHint;
  nextContent.services.makeupTitle =
    toText(formData.get("servicesMakeupTitle")) || currentServices.makeupTitle;
  nextContent.services.makeupHint =
    toText(formData.get("servicesMakeupHint")) || currentServices.makeupHint;
  nextContent.services.hairstyleTitle =
    toText(formData.get("servicesHairstyleTitle")) ||
    currentServices.hairstyleTitle;
  nextContent.services.hairstyleHint =
    toText(formData.get("servicesHairstyleHint")) || currentServices.hairstyleHint;
  nextContent.services.hairstyleLabel =
    toText(formData.get("servicesHairstyleLabel")) || currentServices.hairstyleLabel;
  nextContent.services.stylingTitle =
    toText(formData.get("servicesStylingTitle")) || currentServices.stylingTitle;
  nextContent.services.stylingHint =
    toText(formData.get("servicesStylingHint")) || currentServices.stylingHint;
  nextContent.services.artDirectionTitle =
    toText(formData.get("servicesArtDirectionTitle")) ||
    currentServices.artDirectionTitle;
  nextContent.services.artDirectionHint =
    toText(formData.get("servicesArtDirectionHint")) ||
    currentServices.artDirectionHint;
  nextContent.services.lightOperatorTitle =
    toText(formData.get("servicesLightOperatorTitle")) ||
    currentServices.lightOperatorTitle;
  nextContent.services.lightOperatorHint =
    toText(formData.get("servicesLightOperatorHint")) ||
    currentServices.lightOperatorHint;
  nextContent.services.lightOperatorLabel =
    toText(formData.get("servicesLightOperatorLabel")) ||
    currentServices.lightOperatorLabel;
  nextContent.services.assistantsTitle =
    toText(formData.get("servicesAssistantsTitle")) ||
    currentServices.assistantsTitle;
  nextContent.services.assistantsHint =
    toText(formData.get("servicesAssistantsHint")) ||
    currentServices.assistantsHint;
  nextContent.services.assistantsLabel =
    toText(formData.get("servicesAssistantsLabel")) ||
    currentServices.assistantsLabel;
  nextContent.services.totalsTitle =
    toText(formData.get("servicesTotalsTitle")) || currentServices.totalsTitle;

  const nextIncludedItems = parseList(
    formData.get("includedItems"),
    current.included.items
  );
  const requestedExtraColors = parseList(
    formData.get("extrasItems"),
    current.extras.items
  );
  const nextExtraItems = clampExtraColors(requestedExtraColors, current.extras.items);
  const nextExtraBackgrounds = buildExtraBackgroundsFromColors({
    colors: nextExtraItems,
    currentBackgrounds: current.extras.backgrounds,
  });
  nextContent.included.items = nextIncludedItems;
  nextContent.extras.items = nextExtraItems;
  nextContent.extras.backgrounds = nextExtraBackgrounds;
  nextContent.extras.maxSelections = resolveExtraMaxSelections(
    current.extras.maxSelections
  );

  const photographyLines = parseList(
    formData.get("servicesPhotographyItems"),
    currentServices.photographyOptions.map(
      (option) => `${option.label}|${option.minHours || 1}`
    )
  );
  const makeupLines = parseList(
    formData.get("servicesMakeupItems"),
    currentServices.makeupOptions.map((option) => option.label)
  );
  const stylingLines = parseList(
    formData.get("servicesStylingItems"),
    currentServices.stylingOptions.map((option) => option.label)
  );
  const artDirectionLines = parseList(
    formData.get("servicesArtDirectionItems"),
    currentServices.artDirectionOptions.map((option) => option.label)
  );

  nextContent.services.photographyOptions = buildServiceOptionsFromLines({
    lines: photographyLines,
    currentOptions: currentServices.photographyOptions,
    fallbackOptions: studio.services.photographyOptions,
    allowMinHours: true,
  });
  nextContent.services.makeupOptions = buildServiceOptionsFromLines({
    lines: makeupLines,
    currentOptions: currentServices.makeupOptions,
    fallbackOptions: studio.services.makeupOptions,
  });
  nextContent.services.stylingOptions = buildServiceOptionsFromLines({
    lines: stylingLines,
    currentOptions: currentServices.stylingOptions,
    fallbackOptions: studio.services.stylingOptions,
  });
  nextContent.services.artDirectionOptions = buildServiceOptionsFromLines({
    lines: artDirectionLines,
    currentOptions: currentServices.artDirectionOptions,
    fallbackOptions: studio.services.artDirectionOptions,
  });
  nextContent.services = normalizeServiceCatalog(nextContent.services);

  nextContent.included.images = await buildCatalogImages({
    orderRaw: formData.get("includedImagesOrder"),
    filePrefix: "includedImageFile_",
    labels: nextIncludedItems,
    currentImages: current.included.images,
    formData,
  });
  nextContent.extras.images = await buildCatalogImages({
    orderRaw: formData.get("extrasImagesOrder"),
    filePrefix: "extrasImageFile_",
    labels: nextExtraItems,
    currentImages: current.extras.images,
    formData,
  });

  const heroAlt = toText(formData.get("heroImageAlt"));
  if (heroAlt) {
    nextContent.hero.image.alt = heroAlt;
  }
  const floorPlanAlt = toText(formData.get("floorPlanAlt"));
  if (floorPlanAlt) {
    nextContent.floorPlan.alt = floorPlanAlt;
  }

  const logoFile = getFile(formData.get("logoImage"));
  if (logoFile) {
    nextContent.logo.src = await saveUpload(logoFile);
  }

  const wordmarkFile = getFile(formData.get("wordmarkImage"));
  if (wordmarkFile) {
    nextContent.logo.wordmarkSrc = await saveUpload(wordmarkFile);
  }

  const heroFile = getFile(formData.get("heroImage"));
  if (heroFile) {
    nextContent.hero.image.src = await saveUpload(heroFile);
  }
  const floorPlanFile = getFile(formData.get("floorPlanImage"));
  if (floorPlanFile) {
    nextContent.floorPlan.src = await saveUpload(floorPlanFile);
  }

  const seoOgFile = getFile(formData.get("seoOgImageFile"));
  if (seoOgFile) {
    nextContent.seo.ogImage = await saveUpload(seoOgFile);
  }

  const galleryOrderRaw = formData.get("galleryOrder");
  if (galleryOrderRaw !== null) {
    try {
      const galleryOrder = JSON.parse(String(galleryOrderRaw)) as {
        id: string;
        src?: string;
        alt?: string;
      }[];
      const updatedGallery = [];
      for (const item of galleryOrder.slice(0, 10)) {
        const file = getFile(formData.get(`galleryFile_${item.id}`));
        let src = item.src || "";
        if (file) {
          src = await saveUpload(file);
        }
        if (!src) continue;
        updatedGallery.push({
          src,
          alt: item.alt || "",
        });
      }
      nextContent.gallery = updatedGallery;
    } catch {
      // ignore invalid gallery payload
    }
  }

  stripLegacyContentFields(nextContent);

  await updateStudioContent(nextContent);

  if (wantsJson) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.redirect(new URL("/admin/content", getBaseUrl(request)));
}

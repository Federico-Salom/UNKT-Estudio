import { NextRequest, NextResponse } from "next/server";
import { handleApiError, safeJsonBody } from "@/lib/api-errors";
import { getSessionFromCookies } from "@/lib/auth";
import { normalizeExtraBackgrounds } from "@/lib/booking";
import { normalizeServiceCatalog } from "@/lib/services";
import { prisma } from "@/lib/prisma";
import { getStudioContent, updateStudioContent } from "@/lib/studio-content";
import type { StudioContent } from "@/content/studio";

export const runtime = "nodejs";

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ ok: false, error: message }, { status });

const ensureAdmin = async () => {
  const session = await getSessionFromCookies();
  if (!session) {
    return { ok: false, response: errorResponse("Sesión expirada.", 401) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user || user.role !== "admin") {
    return { ok: false, response: errorResponse("No autorizado.", 403) };
  }

  return { ok: true };
};

const normalizePrice = (value: unknown) => {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

type ExtraPricingInput = {
  id?: unknown;
  priceSinPisar?: unknown;
  pricePisando?: unknown;
};

type PricingPayload = {
  basePrice?: unknown;
  extras?: unknown;
  services?: unknown;
};

type ServiceOptionPricingInput = {
  id?: unknown;
  price?: unknown;
};

type ServiceRatesPricingInput = {
  modelRatePerHour?: unknown;
  hairstyleRatePerModel?: unknown;
  lightOperatorRatePerHour?: unknown;
  assistantsRatePerHour?: unknown;
};

type ServicesPricingInput = {
  photographyOptions?: unknown;
  makeupOptions?: unknown;
  stylingOptions?: unknown;
  artDirectionOptions?: unknown;
  rates?: unknown;
};

const readOptionPricingMap = (raw: unknown) => {
  if (!Array.isArray(raw)) {
    return null;
  }

  return new Map(
    raw.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const payload = item as ServiceOptionPricingInput;
      const id = String(payload.id ?? "").trim();
      if (!id) {
        return [];
      }

      return [[id, normalizePrice(payload.price)] as const];
    })
  );
};

export async function POST(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (!auth.ok) {
      return auth.response;
    }

    const body = await safeJsonBody<PricingPayload>(request);
    const basePrice = normalizePrice(body.basePrice);
    const extraPricesRaw = Array.isArray(body.extras) ? body.extras : null;
    const servicesRaw =
      body.services && typeof body.services === "object"
        ? (body.services as ServicesPricingInput)
        : null;

  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return errorResponse("El precio base debe ser mayor a 0.");
  }

  if (!extraPricesRaw) {
    return errorResponse("Faltan los precios de fondos.");
  }
  if (!servicesRaw) {
    return errorResponse("Faltan los precios de servicios.");
  }

  const current = await getStudioContent();
  const currentBackgrounds = normalizeExtraBackgrounds(current.extras.backgrounds);
  const currentServices = normalizeServiceCatalog(current.services);

  if (extraPricesRaw.length !== currentBackgrounds.length) {
    return errorResponse("La cantidad de fondos no coincide.");
  }

  const incomingById = new Map(
    extraPricesRaw.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }
      const payload = item as ExtraPricingInput;
      const id = String(payload.id ?? "").trim();
      if (!id) {
        return [];
      }
      return [[id, payload] as const];
    })
  );
  const photographyPriceMap = readOptionPricingMap(
    servicesRaw.photographyOptions
  );
  const makeupPriceMap = readOptionPricingMap(servicesRaw.makeupOptions);
  const stylingPriceMap = readOptionPricingMap(servicesRaw.stylingOptions);
  const artDirectionPriceMap = readOptionPricingMap(
    servicesRaw.artDirectionOptions
  );

  if (
    !photographyPriceMap ||
    !makeupPriceMap ||
    !stylingPriceMap ||
    !artDirectionPriceMap
  ) {
    return errorResponse("Faltan precios en opciones de servicios.");
  }

  if (
    photographyPriceMap.size !== currentServices.photographyOptions.length ||
    makeupPriceMap.size !== currentServices.makeupOptions.length ||
    stylingPriceMap.size !== currentServices.stylingOptions.length ||
    artDirectionPriceMap.size !== currentServices.artDirectionOptions.length
  ) {
    return errorResponse("La cantidad de opciones de servicios no coincide.");
  }

  const nextContent: StudioContent = JSON.parse(
    JSON.stringify(current)
  ) as StudioContent;

  nextContent.pricing.basePrice = basePrice;
  let invalidPrice = false;
  const nextBackgrounds = currentBackgrounds.map((background) => {
    const payload = incomingById.get(background.id);
    const priceSinPisar = normalizePrice(payload?.priceSinPisar);
    const pricePisando = normalizePrice(payload?.pricePisando);

    if (
      !Number.isFinite(priceSinPisar) ||
      priceSinPisar < 0 ||
      !Number.isFinite(pricePisando) ||
      pricePisando < 0
    ) {
      invalidPrice = true;
      return background;
    }

    return {
      ...background,
      priceSinPisar,
      pricePisando,
    };
  });

  if (invalidPrice) {
    return errorResponse("Revisa los precios de fondos.");
  }

  nextContent.extras.backgrounds = normalizeExtraBackgrounds(nextBackgrounds);
  nextContent.extras.items = nextContent.extras.backgrounds.map(
    (background) => background.color
  );

  const ratesPayload =
    servicesRaw.rates && typeof servicesRaw.rates === "object"
      ? (servicesRaw.rates as ServiceRatesPricingInput)
      : null;
  if (!ratesPayload) {
    return errorResponse("Faltan tarifas de servicios.");
  }

  const modelRatePerHour = normalizePrice(ratesPayload.modelRatePerHour);
  const hairstyleRatePerModel = normalizePrice(ratesPayload.hairstyleRatePerModel);
  const lightOperatorRatePerHour = normalizePrice(
    ratesPayload.lightOperatorRatePerHour
  );
  const assistantsRatePerHour = normalizePrice(
    ratesPayload.assistantsRatePerHour
  );

  if (
    !Number.isFinite(modelRatePerHour) ||
    modelRatePerHour < 0 ||
    !Number.isFinite(hairstyleRatePerModel) ||
    hairstyleRatePerModel < 0 ||
    !Number.isFinite(lightOperatorRatePerHour) ||
    lightOperatorRatePerHour < 0 ||
    !Number.isFinite(assistantsRatePerHour) ||
    assistantsRatePerHour < 0
  ) {
    return errorResponse("Revisa las tarifas por categoría de servicios.");
  }

  let invalidServicePrice = false;
  const mapServicePrices = (
    options: StudioContent["services"]["photographyOptions"],
    prices: Map<string, number>
  ) =>
    options.map((option) => {
      const nextPrice = prices.get(option.id);
      if (!Number.isFinite(nextPrice) || (nextPrice as number) < 0) {
        invalidServicePrice = true;
        return option;
      }
      return {
        ...option,
        price: Math.round(nextPrice as number),
      };
    });

  nextContent.services = normalizeServiceCatalog({
    ...currentServices,
    photographyOptions: mapServicePrices(
      currentServices.photographyOptions,
      photographyPriceMap
    ),
    makeupOptions: mapServicePrices(currentServices.makeupOptions, makeupPriceMap),
    stylingOptions: mapServicePrices(
      currentServices.stylingOptions,
      stylingPriceMap
    ),
    artDirectionOptions: mapServicePrices(
      currentServices.artDirectionOptions,
      artDirectionPriceMap
    ),
    modelRatePerHour: Math.round(modelRatePerHour),
    hairstyleRatePerModel: Math.round(hairstyleRatePerModel),
    lightOperatorRatePerHour: Math.round(lightOperatorRatePerHour),
    assistantsRatePerHour: Math.round(assistantsRatePerHour),
  });

  if (invalidServicePrice) {
    return errorResponse("Revisa los precios de opciones de servicios.");
  }

  await updateStudioContent(nextContent);

  return NextResponse.json({
    ok: true,
    pricing: {
      basePrice: nextContent.pricing.basePrice,
      extras: nextContent.extras.backgrounds,
      services: nextContent.services,
    },
  });
  } catch (error) {
    return handleApiError("api/admin/pricing", error, {
      defaultMessage: "No se pudo actualizar la configuracion de precios.",
    });
  }
}

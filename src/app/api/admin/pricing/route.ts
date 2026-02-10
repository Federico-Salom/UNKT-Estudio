import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudioContent, updateStudioContent } from "@/lib/studio-content";
import type { StudioContent } from "@/content/studio";

export const runtime = "nodejs";

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ ok: false, error: message }, { status });

const ensureAdmin = async () => {
  const session = await getSessionFromCookies();
  if (!session) {
    return { ok: false, response: errorResponse("Sesion expirada.", 401) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user || user.role !== "admin") {
    return { ok: false, response: errorResponse("No autorizado.", 403) };
  }

  return { ok: true };
};

const formatPriceLabel = (value: number) => `$${Math.round(value).toLocaleString("es-AR")}`;

const updatePriceInLabel = (label: string, price: number) => {
  const formattedPrice = formatPriceLabel(price);
  const trimmed = label.trim();
  const moneyPattern = /\$\s*[\d.,]+/;
  const thousandPattern = /\d+(?:[.,]\d+)?\s*mil\b/i;

  if (moneyPattern.test(trimmed)) {
    return trimmed.replace(moneyPattern, formattedPrice);
  }

  if (thousandPattern.test(trimmed)) {
    return trimmed.replace(thousandPattern, formattedPrice);
  }

  if (!trimmed) {
    return formattedPrice;
  }

  return `${trimmed} - ${formattedPrice}`;
};

const normalizePrice = (value: unknown) => {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

type PricingPayload = {
  basePrice?: unknown;
  extras?: unknown;
};

export async function POST(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const body = (await request.json().catch(() => ({}))) as PricingPayload;
  const basePrice = normalizePrice(body.basePrice);
  const extraPricesRaw = Array.isArray(body.extras) ? body.extras : null;

  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return errorResponse("El precio base debe ser mayor a 0.");
  }

  if (!extraPricesRaw) {
    return errorResponse("Faltan los precios de extras.");
  }

  const extraPrices = extraPricesRaw.map(normalizePrice);
  if (
    extraPrices.some((price) => !Number.isFinite(price) || price < 0)
  ) {
    return errorResponse("Revisa los precios de extras.");
  }

  const current = await getStudioContent();
  if (extraPrices.length !== current.extras.items.length) {
    return errorResponse("La cantidad de extras no coincide.");
  }

  const nextContent: StudioContent = JSON.parse(
    JSON.stringify(current)
  ) as StudioContent;

  nextContent.pricing.basePrice = basePrice;
  nextContent.extras.items = current.extras.items.map((item, index) =>
    updatePriceInLabel(item, extraPrices[index] ?? 0)
  );

  nextContent.extras.images = nextContent.extras.images.map((image, index) => {
    const previousLabel = current.extras.items[index];
    const nextLabel = nextContent.extras.items[index] || previousLabel;
    const previousAutoAlt = `Imagen de ${previousLabel}`;

    if (image.alt === previousAutoAlt) {
      return {
        ...image,
        alt: `Imagen de ${nextLabel}`,
      };
    }

    return image;
  });

  await updateStudioContent(nextContent);

  return NextResponse.json({
    ok: true,
    pricing: {
      basePrice: nextContent.pricing.basePrice,
      extras: nextContent.extras.items,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { normalizeExtraBackgrounds } from "@/lib/booking";
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

  const current = await getStudioContent();
  const currentBackgrounds = normalizeExtraBackgrounds(current.extras.backgrounds);

  if (extraPricesRaw.length !== currentBackgrounds.length) {
    return errorResponse("La cantidad de extras no coincide.");
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
    return errorResponse("Revisa los precios de extras.");
  }

  nextContent.extras.backgrounds = normalizeExtraBackgrounds(nextBackgrounds);
  nextContent.extras.items = nextContent.extras.backgrounds.map(
    (background) => background.color
  );

  await updateStudioContent(nextContent);

  return NextResponse.json({
    ok: true,
    pricing: {
      basePrice: nextContent.pricing.basePrice,
      extras: nextContent.extras.backgrounds,
    },
  });
}

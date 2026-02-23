import { NextRequest, NextResponse } from "next/server";
import { pruneExpiredPendingBookings } from "@/lib/booking-expiration";

export const runtime = "nodejs";

const getCronSecret = () => process.env.MAINTENANCE_CRON_SECRET?.trim() || "";

const getBearerToken = (request: NextRequest) => {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
};

const isAuthorized = (request: NextRequest) => {
  const configuredSecret = getCronSecret();
  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const bearerToken = getBearerToken(request);
  const queryToken = request.nextUrl.searchParams.get("secret")?.trim() || "";
  return bearerToken === configuredSecret || queryToken === configuredSecret;
};

const unauthorizedResponse = () =>
  NextResponse.json(
    {
      ok: false,
      error:
        "No autorizado. Configura MAINTENANCE_CRON_SECRET y envia Authorization: Bearer <secret>.",
    },
    { status: 401 }
  );

const runCleanup = async () => {
  const result = await pruneExpiredPendingBookings();
  return NextResponse.json({
    ok: true,
    ...result,
    executedAt: new Date().toISOString(),
  });
};

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return unauthorizedResponse();
  }

  return runCleanup();
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return unauthorizedResponse();
  }

  return runCleanup();
}

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const metric = await prisma.siteMetric.upsert({
      where: { id: "global" },
      update: { visits: { increment: 1 } },
      create: { id: "global", visits: 1 },
    });

    return NextResponse.json({ visits: metric.visits });
  } catch (error) {
    return handleApiError("api/metrics/visit", error, {
      defaultMessage: "No se pudo registrar la visita.",
    });
  }
}

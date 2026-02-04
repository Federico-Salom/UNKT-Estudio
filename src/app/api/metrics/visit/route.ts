import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const metric = await prisma.siteMetric.upsert({
    where: { id: "global" },
    update: { visits: { increment: 1 } },
    create: { id: "global", visits: 1 },
  });

  return NextResponse.json({ visits: metric.visits });
}

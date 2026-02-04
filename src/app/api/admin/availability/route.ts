import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";
import { buildDateTime } from "@/lib/booking";

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

export async function POST(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const startISO = String(body.startISO || "");
  const endISO = String(body.endISO || "");
  const date = String(body.date || "");
  const start = String(body.start || "");
  const end = String(body.end || "");

  let startDate: Date;
  let endDate: Date;

  if (startISO && endISO) {
    startDate = new Date(startISO);
    endDate = new Date(endISO);
  } else {
    if (!date || !start || !end) {
      return errorResponse("Completa fecha y horario.");
    }
    startDate = buildDateTime(date, start);
    endDate = buildDateTime(date, end);
  }

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return errorResponse("Fecha u hora inválida.");
  }
  if (endDate <= startDate) {
    return errorResponse("El horario final debe ser mayor al inicial.");
  }

  const slots = [];
  const cursor = new Date(startDate);
  while (cursor < endDate) {
    const next = new Date(cursor.getTime() + 60 * 60 * 1000);
    slots.push({ start: new Date(cursor), end: next, status: "available" });
    cursor.setHours(cursor.getHours() + 1);
  }

  if (!slots.length) {
    return errorResponse("No hay horarios para agregar.");
  }

  const existing = await prisma.availabilitySlot.findMany({
    where: { start: { in: slots.map((slot) => slot.start) } },
    select: { start: true },
  });

  const existingSet = new Set(
    existing.map((slot) => slot.start.getTime())
  );

  const toCreate = slots.filter(
    (slot) => !existingSet.has(slot.start.getTime())
  );

  if (toCreate.length) {
    await prisma.availabilitySlot.createMany({
      data: toCreate,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const slotId = String(body.slotId || "");
  const status = String(body.status || "");
  const startISO = String(body.startISO || "");
  const endISO = String(body.endISO || "");
  const date = String(body.date || "");
  const start = String(body.start || "");
  const end = String(body.end || "");

  if (!slotId) return errorResponse("Horario inválido.");

  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
  });

  if (!slot) {
    return errorResponse("Horario no encontrado.", 404);
  }

  if (slot.status === "booked") {
    return errorResponse("No puedes cambiar un horario ya reservado.");
  }

  if (startISO || endISO || (date && start && end)) {
    let nextStart: Date;
    let nextEnd: Date;

    if (startISO && endISO) {
      nextStart = new Date(startISO);
      nextEnd = new Date(endISO);
    } else {
      nextStart = buildDateTime(date, start);
      nextEnd = buildDateTime(date, end);
    }

    if (
      Number.isNaN(nextStart.getTime()) ||
      Number.isNaN(nextEnd.getTime())
    ) {
      return errorResponse("Fecha u hora inválida.");
    }
    if (nextEnd <= nextStart) {
      return errorResponse("El horario final debe ser mayor al inicial.");
    }

    const existing = await prisma.availabilitySlot.findFirst({
      where: {
        start: nextStart,
        id: { not: slotId },
      },
    });

    if (existing) {
      return errorResponse("Ya existe un horario con ese inicio.");
    }

    const updated = await prisma.availabilitySlot.update({
      where: { id: slotId },
      data: { start: nextStart, end: nextEnd },
    });

    return NextResponse.json({
      ok: true,
      status: updated.status,
      start: updated.start,
      end: updated.end,
    });
  }

  if (status !== "available" && status !== "blocked") {
    return errorResponse("Estado inválido.");
  }

  const updated = await prisma.availabilitySlot.update({
    where: { id: slotId },
    data: { status },
  });

  return NextResponse.json({ ok: true, status: updated.status });
}

export async function DELETE(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const slotId = String(body.slotId || "");

  if (!slotId) return errorResponse("Horario inválido.");

  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
  });

  if (!slot) {
    return errorResponse("Horario no encontrado.", 404);
  }

  if (slot.status === "booked") {
    return errorResponse("No puedes eliminar un horario reservado.");
  }

  await prisma.availabilitySlot.delete({
    where: { id: slotId },
  });

  return NextResponse.json({ ok: true });
}

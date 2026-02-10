import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/auth";
import { BOOKING_TIMEZONE, buildDateTime } from "@/lib/booking";
import { getAvailabilityCutoffDate } from "@/lib/availability";

export const runtime = "nodejs";

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ ok: false, error: message }, { status });

const hourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BOOKING_TIMEZONE,
  hour: "2-digit",
  hour12: false,
});

const getLocalHour = (date: Date) => Number(hourFormatter.format(date));

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
    return errorResponse("Fecha u hora invalida.");
  }
  if (endDate <= startDate) {
    return errorResponse("El horario final debe ser mayor al inicial.");
  }

  const slots: { start: Date; end: Date }[] = [];
  const cursor = new Date(startDate);

  while (cursor < endDate) {
    const next = new Date(cursor.getTime() + 60 * 60 * 1000);
    slots.push({
      start: new Date(cursor),
      end: next,
    });
    cursor.setHours(cursor.getHours() + 1);
  }

  if (!slots.length) {
    return errorResponse("No hay horarios para agregar.");
  }
  const cutoff = getAvailabilityCutoffDate();
  const candidateSlots = slots.filter((slot) => slot.start.getTime() > cutoff.getTime());

  if (!candidateSlots.length) {
    return errorResponse(
      "Solo puedes agregar horarios con al menos 2 horas de anticipacion."
    );
  }

  const existing = await prisma.availabilitySlot.findMany({
    where: { start: { in: candidateSlots.map((slot) => slot.start) } },
    select: { start: true },
  });

  const existingSet = new Set(existing.map((slot) => slot.start.getTime()));
  const toCreate = candidateSlots.filter(
    (slot) => !existingSet.has(slot.start.getTime())
  );

  if (toCreate.length) {
    await prisma.availabilitySlot.createMany({
      data: toCreate.map((slot) => ({
        start: slot.start,
        end: slot.end,
        status: "available",
      })),
    });
  }

  return NextResponse.json({ ok: true, createdCount: toCreate.length });
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

  if (!slotId) return errorResponse("Horario invalido.");

  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
  });

  if (!slot) {
    return errorResponse("Horario no encontrado.", 404);
  }

  if (slot.status === "booked") {
    return errorResponse("No puedes cambiar un horario ya reservado.");
  }

  const cutoff = getAvailabilityCutoffDate();

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

    if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime())) {
      return errorResponse("Fecha u hora invalida.");
    }
    if (nextEnd <= nextStart) {
      return errorResponse("El horario final debe ser mayor al inicial.");
    }
    if (nextStart.getTime() <= cutoff.getTime()) {
      return errorResponse(
        "No se puede mover un horario pasado o con menos de 2 horas de anticipacion."
      );
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
      data: { start: nextStart, end: nextEnd, status: "available" },
    });

    return NextResponse.json({
      ok: true,
      status: updated.status,
      start: updated.start,
      end: updated.end,
    });
  }

  if (!status) {
    return errorResponse("No hay cambios para guardar.");
  }

  if (status !== "available") {
    return errorResponse("Estado invalido.");
  }

  if (status === "available" && slot.start.getTime() <= cutoff.getTime()) {
    return errorResponse(
      "No se puede habilitar un horario pasado o con menos de 2 horas de anticipacion."
    );
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

  const startISO = String(body.startISO || "");
  const endISO = String(body.endISO || "");
  const viewType = String(body.viewType || "");
  const timeWindowMode = String(body.timeWindowMode || "");

  if (startISO && endISO) {
    const startDate = new Date(startISO);
    const endDate = new Date(endISO);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return errorResponse("Rango de fechas invalido.");
    }
    if (endDate <= startDate) {
      return errorResponse("El rango de fechas es invalido.");
    }

    const isTimeGridView = viewType.startsWith("timeGrid");
    const isNightWindow = isTimeGridView && timeWindowMode === "night";
    const isDayWindow = isTimeGridView && timeWindowMode === "day";

    const rangeStart = isNightWindow
      ? new Date(startDate.getTime() + 19 * 60 * 60 * 1000)
      : startDate;
    const rangeEnd = isNightWindow
      ? new Date(endDate.getTime() + 7 * 60 * 60 * 1000)
      : endDate;

    const candidates = await prisma.availabilitySlot.findMany({
      where: {
        start: {
          gte: rangeStart,
          lt: rangeEnd,
        },
        status: {
          not: "booked",
        },
      },
      select: {
        id: true,
        start: true,
      },
    });

    const filtered =
      isDayWindow || isNightWindow
        ? candidates.filter((slot) => {
            const hour = getLocalHour(slot.start);
            if (isDayWindow) {
              return hour >= 7 && hour < 19;
            }
            return hour >= 19 || hour < 7;
          })
        : candidates;

    if (!filtered.length) {
      return NextResponse.json({ ok: true, deletedCount: 0 });
    }

    const deleted = await prisma.availabilitySlot.deleteMany({
      where: {
        id: {
          in: filtered.map((slot) => slot.id),
        },
      },
    });

    return NextResponse.json({ ok: true, deletedCount: deleted.count });
  }
  if (!slotId) return errorResponse("Horario invalido.");

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

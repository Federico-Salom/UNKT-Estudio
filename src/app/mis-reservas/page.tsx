import Link from "next/link";
import { redirect } from "next/navigation";
import Container from "@/components/Container";
import Header from "@/components/Header";
import { getSessionFromCookies } from "@/lib/auth";
import { BOOKING_TIMEZONE } from "@/lib/booking";
import {
  getServicesSummaryLines,
  parseStoredServicesSelection,
} from "@/lib/services";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

const parseStringArray = (value: string) => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const getBookingSlotIds = (slotIdsValue: string, slotId: string | null) => {
  const parsed = parseStringArray(slotIdsValue);
  if (parsed.length) {
    return Array.from(new Set(parsed));
  }
  if (slotId) {
    return [slotId];
  }
  return [];
};

const getStatusLabel = (status: string) => {
  if (status === "paid") return "Pago confirmado";
  if (status === "pending_payment") return "Pago pendiente";
  return "Estado";
};

const getStatusToneClassName = (status: string) => {
  if (status === "paid") {
    return "border-accent/35 bg-accent/10 text-accent";
  }
  if (status === "pending_payment") {
    return "border-fg/20 bg-bg/70 text-fg";
  }
  return "border-fg/20 bg-bg/70 text-fg";
};

export default async function MisReservasPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      createdAt: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  const [studio, bookings] = await Promise.all([
    getStudioContent(),
    prisma.booking.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slotId: true,
        slotIds: true,
        name: true,
        email: true,
        phone: true,
        extras: true,
        services: true,
        total: true,
        status: true,
        hours: true,
        createdAt: true,
      },
    }),
  ]);

  const slotIdSet = new Set<string>();
  const slotIdsByBookingId = new Map<string, string[]>();

  bookings.forEach((booking) => {
    const slotIds = getBookingSlotIds(booking.slotIds, booking.slotId);
    slotIdsByBookingId.set(booking.id, slotIds);
    slotIds.forEach((slotId) => slotIdSet.add(slotId));
  });

  const slots = slotIdSet.size
    ? await prisma.availabilitySlot.findMany({
        where: { id: { in: Array.from(slotIdSet) } },
        select: {
          id: true,
          start: true,
          end: true,
        },
      })
    : [];

  const slotsById = new Map(
    slots.map((slot) => [
      slot.id,
      {
        start: slot.start,
        end: slot.end,
      },
    ])
  );

  const dateFormatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: BOOKING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFormatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: BOOKING_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: BOOKING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const detailedBookings = bookings.map((booking) => {
    const slotIds = slotIdsByBookingId.get(booking.id) || [];
    const bookingSlots = slotIds
      .map((slotId) => slotsById.get(slotId))
      .filter((slot): slot is { start: Date; end: Date } => Boolean(slot));

    const firstSlot = bookingSlots[0];
    const lastSlot = bookingSlots[bookingSlots.length - 1];
    const slotLabel =
      firstSlot && lastSlot
        ? `${dateFormatter.format(firstSlot.start)} | ${timeFormatter.format(
            firstSlot.start
          )} - ${timeFormatter.format(lastSlot.end)}`
        : "Sin horario asignado";
    const extras = parseStringArray(booking.extras);
    const hoursCount = booking.hours || bookingSlots.length || 1;
    const servicesSelection = parseStoredServicesSelection(
      booking.services || "[]",
      studio.services
    );
    const services = getServicesSummaryLines({
      selection: servicesSelection,
      catalog: studio.services,
      hours: hoursCount,
    }).map((item) => item.label);

    return {
      ...booking,
      slotLabel,
      extrasLabel: extras.length ? extras.join(", ") : "Sin fondos",
      servicesLabel: services.length ? services.join(", ") : "Sin servicios",
      hoursCount,
      totalLabel: `$${booking.total.toLocaleString("es-AR")}`,
      createdAtLabel: dateTimeFormatter.format(booking.createdAt),
      statusLabel: getStatusLabel(booking.status),
      statusToneClassName: getStatusToneClassName(booking.status),
    };
  });

  return (
    <div className="account-page min-h-screen bg-bg text-fg">
      <Header studio={studio} />

      <main className="px-4 py-16">
        <Container className="max-w-5xl">
          <section className="mx-auto w-full max-w-3xl rounded-[2.5rem] border border-accent/20 bg-bg/90 p-6 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur-xl sm:p-10">
            <header className="space-y-2">
              <h1 className="font-display text-3xl uppercase tracking-[0.2em] text-fg">
                Mis reservas
              </h1>
              <p className="text-sm text-muted">
                Revisa el detalle de tus reservas y su estado.
              </p>
            </header>

            {detailedBookings.length ? (
              <div className="mt-8 grid gap-4">
                {detailedBookings.map((booking) => (
                  <article
                    key={booking.id}
                    className="rounded-3xl border border-accent/15 bg-white/70 p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted">
                          Reserva
                        </p>
                        <p className="mt-1 text-sm font-semibold text-fg">
                          {booking.slotLabel}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${booking.statusToneClassName}`}
                      >
                        {booking.statusLabel}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-fg/90">
                      <p>
                        <span className="font-semibold">Cliente:</span> {booking.name}
                      </p>
                      <p>
                        <span className="font-semibold">Email:</span> {booking.email}
                      </p>
                      <p>
                        <span className="font-semibold">Telefono:</span>{" "}
                        {booking.phone}
                      </p>
                      <p>
                        <span className="font-semibold">Horas:</span>{" "}
                        {booking.hoursCount}
                      </p>
                      <p>
                        <span className="font-semibold">Fondos:</span>{" "}
                        {booking.extrasLabel}
                      </p>
                      <p>
                        <span className="font-semibold">Servicios:</span>{" "}
                        {booking.servicesLabel}
                      </p>
                      <p>
                        <span className="font-semibold">Total:</span>{" "}
                        {booking.totalLabel}
                      </p>
                      <p>
                        <span className="font-semibold">Creada:</span>{" "}
                        {booking.createdAtLabel}
                      </p>
                    </div>

                    <div className="mt-5">
                      <Link
                        href={`/checkout?bookingId=${booking.id}`}
                        className="inline-flex items-center rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent transition hover:border-accent hover:bg-accent/20"
                      >
                        {booking.status === "pending_payment"
                          ? "Pagar reserva"
                          : "Ver detalle"}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-3xl border border-accent/15 bg-white/70 p-6 sm:p-8">
                <p className="text-sm text-muted">
                  Todavia no tenes reservas registradas. Cuando hagas una, la vas
                  a ver aca con todo su detalle.
                </p>
                <Link
                  href="/reservar"
                  className="mt-5 inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-bg transition hover:bg-accent2"
                >
                  Reservar
                </Link>
              </div>
            )}
          </section>
        </Container>
      </main>
    </div>
  );
}

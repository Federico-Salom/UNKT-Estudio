import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import BrandMark from "@/components/BrandMark";
import CheckoutPriceDetails from "@/components/CheckoutPriceDetails";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { getSessionFromCookies } from "@/lib/auth";
import {
  BOOKING_TIMEZONE,
  calculateBookingPricing,
  dedupeExtras,
  getExtraPrice,
  getConfiguredBookingHolidayDates,
  resolveBasePrice,
} from "@/lib/booking";
import {
  getServicesBreakdown,
  getServicesSummaryLines,
  parseStoredServicesSelection,
} from "@/lib/services";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

type CheckoutPageProps = {
  searchParams?: Promise<{ bookingId?: string | string[] }>;
};

type BookingSummaryItem = {
  id: string;
  value: ReactNode;
  spanFull?: boolean;
  editHref?: string;
  editLabel?: string;
};

const parseStringArray = (value: string) => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item)).filter(Boolean);
  } catch {
    return [];
  }
};

const getFirstParamValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const PencilIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.06 4.19l3.75 3.75"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const bookingId = getFirstParamValue(resolvedSearchParams?.bookingId)?.trim();
  const [studio, user] = await Promise.all([
    getStudioContent(),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
  ]);

  if (!user) {
    redirect("/login");
  }

  const roleLabel = user.role === "admin" ? "Administrador" : "Usuario";
  const createdAtLabel = user.createdAt.toLocaleString("es-AR");
  const userMenuData = {
    email: user.email,
    roleLabel,
    id: user.id,
    createdAtLabel,
  };

  const header = (
    <header className="border-b border-accent/20 bg-bg/95 backdrop-blur">
      <div className="flex w-full items-center justify-between gap-2.5 px-3 py-2.5 sm:px-6 sm:py-4 lg:px-8">
        <div className="sm:hidden">
          <BrandMark studio={studio} showText={false} size={36} />
        </div>
        <div className="hidden sm:block">
          <BrandMark studio={studio} />
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Link
            href="/mis-reservas"
            prefetch={false}
            className="inline-flex h-9 items-center justify-center rounded-full border border-accent/35 bg-accent/10 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent transition hover:border-accent hover:bg-accent/20 sm:px-4 sm:text-xs md:h-10"
          >
            <span className="sm:hidden">Reservas</span>
            <span className="hidden sm:inline">Mis reservas</span>
          </Link>
          <ThemeToggle className="h-9 w-9 md:h-10 md:w-10" />
          <UserMenu
            triggerClassName="h-9 w-9 md:h-10 md:w-10"
            user={userMenuData}
          />
        </div>
      </div>
    </header>
  );

  if (!bookingId) {
    return (
      <div className="auth-page checkout-page min-h-screen bg-bg text-fg">
        {header}

        <main className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <section className="checkout-shell mx-auto w-full max-w-5xl p-3 sm:p-4">
            <div className="checkout-layout">
              <div className="checkout-panel rounded-3xl p-5 sm:p-8">
                <p className="checkout-kicker text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Checkout
                </p>
                <h1 className="mt-3 font-display text-2xl sm:text-3xl">
                  Reserva no encontrada
                </h1>
                <p className="mt-3 text-sm text-muted">
                  No encontramos una reserva para pagar. Entra desde
                  {" "}&quot;Mis reservas&quot; para continuar.
                </p>
                <Link
                  href="/mis-reservas"
                  prefetch={false}
                  className="mt-6 inline-flex items-center rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent transition hover:border-accent hover:bg-accent/20"
                >
                  Ir a mis reservas
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      slotId: true,
      slotIds: true,
      name: true,
      email: true,
      extras: true,
      services: true,
      total: true,
      hours: true,
      status: true,
    },
  });

  if (!booking) {
    redirect("/mis-reservas");
  }

  const isOwner = booking.userId === session.userId;
  const isAdmin = session.role === "admin";
  if (!isOwner && !isAdmin) {
    redirect("/account");
  }

  const slotIds = parseStringArray(booking.slotIds);
  if (!slotIds.length && booking.slotId) {
    slotIds.push(booking.slotId);
  }

  const [slots, extras] = await Promise.all([
    slotIds.length
      ? prisma.availabilitySlot.findMany({
          where: { id: { in: slotIds } },
          orderBy: { start: "asc" },
          select: {
            start: true,
            end: true,
          },
        })
      : Promise.resolve([]),
    Promise.resolve(parseStringArray(booking.extras)),
  ]);

  const firstSlot = slots[0];
  const lastSlot = slots[slots.length - 1];
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

  const slotDateLabel =
    firstSlot && lastSlot
      ? dateFormatter.format(firstSlot.start)
      : "Sin fecha";
  const slotTimeLabel =
    firstSlot && lastSlot
      ? `${timeFormatter.format(firstSlot.start)} - ${timeFormatter.format(
          lastSlot.end
        )}`
      : "Sin horario";
  const totalLabel = `$${booking.total.toLocaleString("es-AR")}`;
  const statusLabel =
    booking.status === "paid"
      ? "Pago confirmado"
      : booking.status === "pending_payment"
        ? "Pago pendiente"
        : booking.status;
  const statusToneClassName =
    booking.status === "paid"
      ? "border-accent/35 bg-accent/10 text-accent"
      : "border-fg/20 bg-bg/70 text-fg";
  const hours = booking.hours || slots.length || 1;
  const extrasList = dedupeExtras(extras);
  const servicesSelection = parseStoredServicesSelection(
    booking.services || "[]",
    studio.services
  );
  const servicesBreakdown = getServicesBreakdown({
    selection: servicesSelection,
    catalog: studio.services,
    hours,
  });
  const servicesDetails = getServicesSummaryLines({
    selection: servicesBreakdown.selection,
    catalog: studio.services,
    hours,
  });
  const basePrice = resolveBasePrice(studio.pricing.basePrice);
  const extrasBreakdown = extrasList.map((extraLabel) => ({
    label: extraLabel,
    amount: getExtraPrice(extraLabel, studio.extras.backgrounds),
  }));
  const extrasSubtotal = extrasBreakdown.reduce(
    (acc, extra) => acc + extra.amount,
    0
  );
  const pricingBreakdown = calculateBookingPricing({
    basePrice,
    extrasTotal: extrasSubtotal,
    servicesTotal: servicesBreakdown.total,
    slots: slots.map((slot) => ({
      start: slot.start,
      end: slot.end,
    })),
    holidayDates: getConfiguredBookingHolidayDates(),
    fallbackHours: hours,
  });
  const pricingAdjustment = booking.total - pricingBreakdown.grandTotal;
  const editScheduleHref = `/reservar?editBookingId=${booking.id}&editSection=horario`;
  const editExtrasHref = `/reservar?editBookingId=${booking.id}&editSection=extras`;
  const editServicesHref = `/reservar?editBookingId=${booking.id}&editSection=servicios`;
  const infoEntries = [
    {
      label: "Nombre",
      value: booking.name,
    },
    {
      label: "Duración",
      value: `${hours} ${hours === 1 ? "hora" : "horas"}`,
    },
    {
      label: "Fecha",
      value: slotDateLabel,
    },
    {
      label: "Horario",
      value: slotTimeLabel,
    },
  ];

  const bookingSummaryItems: BookingSummaryItem[] = [
    {
      id: "info",
      value: (
        <ul className="space-y-1 text-left">
          {infoEntries.map((entry) => (
            <li key={entry.label} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70"
              />
              <span>
                <span className="font-semibold">{entry.label}:</span>{" "}
                {entry.value}
              </span>
            </li>
          ))}
        </ul>
      ),
      spanFull: true,
      editHref:
        booking.status === "pending_payment" ? editScheduleHref : undefined,
      editLabel: "Editar fecha y horario",
    },
    {
      id: "extras",
      value: extrasList.length ? (
        <ul className="space-y-1 text-left">
          {extrasList.map((extra) => (
            <li key={extra} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70"
              />
              <span>{extra}</span>
            </li>
          ))}
        </ul>
      ) : (
        "Sin fondos"
      ),
      spanFull: true,
      editHref:
        booking.status === "pending_payment" ? editExtrasHref : undefined,
      editLabel: "Editar fondos",
    },
    {
      id: "services",
      value: servicesDetails.length ? (
        <ul className="space-y-1 text-left">
          {servicesDetails.map((service) => (
            <li key={service.label} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70"
              />
              <span>{service.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        "Sin servicios"
      ),
      spanFull: true,
      editHref:
        booking.status === "pending_payment" ? editServicesHref : undefined,
      editLabel: "Editar servicios",
    },
  ];

  return (
    <div className="auth-page checkout-page min-h-screen bg-bg text-fg">
      {header}

      <main className="px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <section className="checkout-shell mx-auto w-full max-w-6xl p-3 sm:p-4 lg:p-5">
          <div className="checkout-layout grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
            <section className="checkout-panel rounded-3xl p-5 sm:p-6">
              <div className="checkout-meta-row flex items-center justify-between gap-3">
                <p className="checkout-kicker whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-muted [overflow-wrap:normal] [word-break:normal]">
                  Checkout
                </p>
                <span className={`checkout-status-pill ${statusToneClassName}`}>
                  {statusLabel}
                </span>
              </div>
              <div className="mt-3 h-px w-full rounded-full bg-accent/20" />

              <div className="mt-4 space-y-4">
                <dl className="checkout-summary-grid">
                  {bookingSummaryItems.map((item) => (
                    <div
                      key={item.id}
                      className={`checkout-summary-item rounded-2xl ${
                        item.spanFull ? "checkout-summary-item-wide sm:col-span-2" : ""
                      } ${item.editHref ? "checkout-summary-item-with-action" : ""}`}
                    >
                      <dd className="checkout-summary-value min-w-0">{item.value}</dd>
                      {item.editHref ? (
                        <Link
                          href={item.editHref}
                          prefetch={false}
                          aria-label={item.editLabel || "Editar"}
                          className="checkout-summary-edit-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/35 bg-accent/10 text-accent transition hover:border-accent hover:bg-accent/20"
                        >
                          <PencilIcon />
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </dl>

                <div className="h-px w-full rounded-full bg-accent/20" />

                <div className="checkout-total-card flex flex-col justify-between gap-4 rounded-2xl px-4 py-3 sm:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent/80">
                      Total a pagar
                    </p>
                    <CheckoutPriceDetails
                      total={booking.total}
                      basePrice={basePrice}
                      hours={hours}
                      extras={extrasBreakdown}
                      services={servicesDetails}
                      weekendOrHolidaySurcharge={
                        pricingBreakdown.weekendOrHolidaySurcharge
                      }
                      weekendOrHolidayHours={pricingBreakdown.weekendOrHolidayHours}
                      nightSurcharge={pricingBreakdown.nightSurcharge}
                      nightHours={pricingBreakdown.nightHours}
                      adjustment={pricingAdjustment}
                      buttonClassName="h-10"
                    />
                  </div>

                  <p className="checkout-total-amount mx-auto font-display text-3xl leading-none text-accent">
                    {totalLabel}
                  </p>
                </div>
              </div>
            </section>

            <section className="checkout-panel rounded-3xl p-5 sm:p-6">
              <div className="checkout-meta-row flex items-center justify-between gap-3">
                <p className="checkout-kicker whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-muted [overflow-wrap:normal] [word-break:normal]">
                  Medios de pago
                </p>
                <span className="checkout-status-pill border-fg/20 bg-bg/70 text-fg">
                  En actualizacion
                </span>
              </div>
              <div className="mt-3 h-px w-full rounded-full bg-accent/20" />

              <div className="mt-4 rounded-2xl border border-accent/35 bg-accent/10 px-4 py-4 text-sm text-accent">
                {booking.status === "paid"
                  ? "Esta reserva ya figura como pagada."
                  : "El checkout online esta deshabilitado temporalmente mientras actualizamos la integracion de pagos."}
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

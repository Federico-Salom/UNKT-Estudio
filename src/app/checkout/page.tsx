import Link from "next/link";
import { redirect } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import CheckoutPriceDetails from "@/components/CheckoutPriceDetails";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import PaymentBrick from "@/components/mercadopago/PaymentBrick";
import { getSessionFromCookies } from "@/lib/auth";
import {
  BOOKING_TIMEZONE,
  dedupeExtras,
  getExtraPrice,
  resolveBasePrice,
} from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

type CheckoutPageProps = {
  searchParams?: Promise<{ bookingId?: string | string[] }>;
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

        <main className="flex min-h-[calc(100vh-74px)] w-full items-start px-3 py-8 sm:px-6 sm:py-14 lg:px-8">
          <section className="checkout-frame w-full p-3 sm:p-4">
            <div className="checkout-layout">
              <div className="checkout-panel rounded-[1.6rem] p-5 sm:p-8">
                <h1 className="font-display text-2xl tracking-[0.06em] sm:text-3xl">
                  Checkout
                </h1>
                <p className="mt-3 text-sm text-muted">
                  No encontramos una reserva para pagar. Entra desde
                  {" "}&quot;Mis reservas&quot; para continuar.
                </p>
                <Link
                  href="/mis-reservas"
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

  const slotLabel =
    firstSlot && lastSlot
      ? `${dateFormatter.format(firstSlot.start)} - ${timeFormatter.format(
          firstSlot.start
        )} - ${timeFormatter.format(lastSlot.end)}`
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
  const extrasLabel = extras.length ? extras.join(", ") : "Sin extras";
  const basePrice = resolveBasePrice(studio.pricing.basePrice);
  const extrasBreakdown = dedupeExtras(extras).map((extraLabel) => ({
    label: extraLabel,
    amount: getExtraPrice(extraLabel, studio.extras.backgrounds),
  }));
  const baseSubtotal = basePrice * hours;
  const extrasSubtotal = extrasBreakdown.reduce(
    (acc, extra) => acc + extra.amount,
    0
  );
  const pricingAdjustment = booking.total - (baseSubtotal + extrasSubtotal);
  const bookingSummaryItems = [
    {
      label: "Cliente",
      value: booking.name,
    },
    {
      label: "Horario",
      value: slotLabel,
    },
    {
      label: "Duracion",
      value: `${hours} ${hours === 1 ? "hora" : "horas"}`,
    },
    {
      label: "Extras",
      value: extrasLabel,
    },
  ];

  return (
    <div className="auth-page checkout-page min-h-screen bg-bg text-fg">
      {header}

      <main className="w-full px-3 py-8 sm:px-6 sm:py-12 lg:px-8">
        <section className="checkout-frame w-full p-3 sm:p-4 lg:p-5">
          <div className="checkout-layout flex w-full flex-col gap-5">
            <header className="checkout-hero relative isolate overflow-hidden rounded-[1.9rem] px-5 py-6 sm:px-7 sm:py-7">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_-12%,rgba(214,36,80,0.5),transparent_62%)] opacity-75"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-60 blur-[1px]"
              />
              <div className="relative flex items-start justify-between gap-3">
                <p className="checkout-kicker whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-muted [overflow-wrap:normal] [word-break:normal]">
                  Checkout
                </p>
                <span className={`checkout-status-pill ${statusToneClassName}`}>
                  {statusLabel}
                </span>
              </div>
              <div className="relative mt-3 w-full text-left">
                <h1 className="font-display text-2xl leading-tight sm:text-3xl">
                  Finaliza el pago de tu reserva
                </h1>
                <p className="mt-2 text-sm text-muted">
                  Confirma los datos y paga sin salir de la pagina.
                </p>
                <div className="mt-3 h-px w-16 rounded-full bg-gradient-to-r from-accent/80 via-accent/40 to-transparent" />
              </div>
            </header>

            <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:gap-5">
              <article className="checkout-panel flex h-full flex-col rounded-3xl p-4 sm:p-5">

                <dl className="mt-4 space-y-3">
                  {bookingSummaryItems.map((item) => (
                    <div
                      key={item.label}
                      className="checkout-summary-item rounded-2xl px-3 py-2.5"
                    >
                      <dt className="text-[11px] uppercase tracking-[0.12em] text-muted">
                        {item.label}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold leading-relaxed text-fg">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="checkout-total-card mt-4 flex flex-1 flex-col justify-between gap-4 rounded-2xl px-4 py-3 sm:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent/80">
                      Total a pagar
                    </p>
                    <CheckoutPriceDetails
                      total={booking.total}
                      basePrice={basePrice}
                      hours={hours}
                      extras={extrasBreakdown}
                      adjustment={pricingAdjustment}
                      buttonClassName="h-10"
                    />
                  </div>

                  <p className="checkout-total-amount mx-auto font-display text-3xl leading-none text-accent">
                    {totalLabel}
                  </p>
                </div>
              </article>

              <div className="flex flex-col gap-4">
                {booking.status === "paid" ? (
                  <div className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                    Esta reserva ya figura como pagada.
                  </div>
                ) : (
                  <PaymentBrick
                    amount={booking.total}
                    title="Reserva UNKT Estudio"
                    payerEmail={booking.email}
                    externalReference={booking.id}
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

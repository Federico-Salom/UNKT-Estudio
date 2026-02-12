import Link from "next/link";
import { redirect } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import PaymentBrick from "@/components/mercadopago/PaymentBrick";
import { getSessionFromCookies } from "@/lib/auth";
import { BOOKING_TIMEZONE } from "@/lib/booking";
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

  if (!bookingId) {
    return (
      <div className="auth-page min-h-screen bg-bg text-fg">
        <header className="border-b border-accent/20 bg-bg/95">
          <Container className="flex items-center justify-between py-4">
            <BrandMark studio={studio} />
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <UserMenu
                user={{
                  email: user.email,
                  roleLabel,
                  id: user.id,
                  createdAtLabel,
                }}
              />
            </div>
          </Container>
        </header>

        <main className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-3xl items-center px-6 py-16">
          <section className="w-full rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
            <h1 className="font-display text-2xl uppercase tracking-[0.18em]">
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
  const hours = booking.hours || slots.length || 1;

  return (
    <div className="auth-page min-h-screen bg-bg text-fg">
      <header className="border-b border-accent/20 bg-bg/95">
        <Container className="flex items-center justify-between py-4">
          <BrandMark studio={studio} />
          <div className="flex items-center gap-4">
            <Link
              href="/mis-reservas"
              className="inline-flex items-center rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent transition hover:border-accent hover:bg-accent/20"
            >
              Mis reservas
            </Link>
            <ThemeToggle />
            <UserMenu
              user={{
                email: user.email,
                roleLabel,
                id: user.id,
                createdAtLabel,
              }}
            />
          </div>
        </Container>
      </header>

      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-6 py-16">
        <section className="w-full max-w-2xl rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
          <h1 className="font-display text-3xl uppercase tracking-[0.2em]">
            Checkout
          </h1>
          <p className="mt-2 text-sm text-muted">
            Paga la reserva sin salir de la pagina.
          </p>

          <div className="mt-6 grid gap-3 text-sm">
            <div>
              <span className="font-semibold">Cliente:</span> {booking.name}
            </div>
            <div>
              <span className="font-semibold">Horario:</span> {slotLabel}
            </div>
            <div>
              <span className="font-semibold">Horas:</span> {hours}
            </div>
            <div>
              <span className="font-semibold">Extras:</span>{" "}
              {extras.length ? extras.join(", ") : "Sin extras"}
            </div>
            <div>
              <span className="font-semibold">Total:</span> {totalLabel}
            </div>
            <div>
              <span className="font-semibold">Estado:</span> {statusLabel}
            </div>
          </div>

          {booking.status === "paid" ? (
            <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
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
        </section>
      </main>
    </div>
  );
}

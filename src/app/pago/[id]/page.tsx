import Link from "next/link";
import { redirect } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BOOKING_TIMEZONE } from "@/lib/booking";
import { getStudioContent } from "@/lib/studio-content";
import MercadoPagoButton from "@/components/MercadoPagoButton";
import UserMenu from "@/components/UserMenu";

export const dynamic = "force-dynamic";

type PagoPageProps = {
  params: { id: string };
  searchParams?: { status?: string | string[] };
};

export default async function PagoPage({ params, searchParams }: PagoPageProps) {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user) {
    redirect("/login");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { slot: true, user: true },
  });

  if (!booking) {
    redirect("/reservar");
  }

  const isOwner = booking.userId === session.userId;
  const isAdmin = session.role === "admin";
  const roleLabel = user.role === "admin" ? "Administrador" : "Usuario";
  const createdAtLabel = user.createdAt.toLocaleString("es-AR");

  if (!isOwner && !isAdmin) {
    redirect("/account");
  }

  const studio = await getStudioContent();

  const extras = (() => {
    try {
      return JSON.parse(booking.extras || "[]") as string[];
    } catch {
      return [];
    }
  })();

  const slotIds = (() => {
    try {
      return JSON.parse(booking.slotIds || "[]") as string[];
    } catch {
      return booking.slotId ? [booking.slotId] : [];
    }
  })();

  if (!slotIds.length && booking.slotId) {
    slotIds.push(booking.slotId);
  }

  const slots = slotIds.length
    ? await prisma.availabilitySlot.findMany({
        where: { id: { in: slotIds } },
        orderBy: { start: "asc" },
      })
    : [];

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
      ? `${dateFormatter.format(firstSlot.start)} · ${timeFormatter.format(
          firstSlot.start
        )} - ${timeFormatter.format(lastSlot.end)}`
      : "Sin horario";
  const totalLabel = `$${booking.total.toLocaleString("es-AR")}`;
  const statusLabel =
    booking.status === "paid"
      ? "Pago confirmado"
      : booking.status === "pending_payment"
        ? "Pago pendiente"
        : "Estado";
  const hours = booking.hours || slots.length || 1;

  const resolvedStatus = Array.isArray(searchParams?.status)
    ? searchParams?.status[0]
    : searchParams?.status;

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-accent/20 bg-bg/95">
        <Container className="flex items-center justify-between py-4">
          <BrandMark studio={studio} />
          <div className="flex items-center gap-6">
            <Link
              className="text-sm font-semibold uppercase tracking-wide text-fg/80 transition hover:text-fg"
              href="/account"
            >
              Mi cuenta
            </Link>
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
        <div className="w-full max-w-xl rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
          <h1 className="font-display text-3xl uppercase tracking-[0.2em]">
            Pago
          </h1>
          <p className="mt-2 text-sm text-muted">
            Completa el pago para confirmar la reserva.
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

          {resolvedStatus === "success" && (
            <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
              Pago aprobado. Estamos confirmando la reserva.
            </div>
          )}
          {resolvedStatus === "pending" && (
            <div className="mt-6 rounded-2xl border border-accent/20 bg-bg px-4 py-3 text-sm text-muted">
              Pago pendiente. Te avisaremos cuando se acredite.
            </div>
          )}
          {resolvedStatus === "failure" && (
            <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
              El pago no se completó. Podés intentar nuevamente.
            </div>
          )}

          <MercadoPagoButton bookingId={booking.id} status={booking.status} />
        </div>
      </main>
    </div>
  );
}

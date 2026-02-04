import Link from "next/link";
import Container from "@/components/Container";
import BookingForm from "@/components/BookingForm";
import { BASE_PRICE, EXTRA_PRICE } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

export default async function ReservarPage() {
  const studio = await getStudioContent();

  const slots = await prisma.availabilitySlot.findMany({
    where: { status: "available" },
    orderBy: { start: "asc" },
  });

  const slotOptions = slots.map((slot) => ({
    id: slot.id,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-accent/20 bg-bg/95">
        <Container className="flex items-center justify-between py-4">
          <Link
            className="font-display text-2xl uppercase tracking-[0.2em] text-fg"
            href="/"
          >
            {studio.name}
          </Link>
          <Link
            className="text-sm font-semibold uppercase tracking-wide text-fg/80 transition hover:text-fg"
            href="/login"
          >
            Iniciar sesión
          </Link>
        </Container>
      </header>

      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
          <h1 className="font-display text-3xl uppercase tracking-[0.2em]">
            Agendar sesión
          </h1>
          <p className="mt-2 text-sm text-muted">
            Reserva por hora y confirma el pago.
          </p>
          {slotOptions.length === 0 && (
            <div
              className="mt-6 rounded-2xl border border-accent/20 bg-bg px-4 py-3 text-sm"
              role="status"
            >
              No hay horarios disponibles. Vuelve más tarde o consulta por
              WhatsApp.
            </div>
          )}

          <BookingForm
            slots={slotOptions}
            extras={studio.extras.items}
            basePrice={BASE_PRICE}
            extraPrice={EXTRA_PRICE}
          />
        </div>
      </main>
    </div>
  );
}

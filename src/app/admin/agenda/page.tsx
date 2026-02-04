import Link from "next/link";
import { redirect } from "next/navigation";
import AdminAgendaPanel from "@/components/AdminAgendaPanel";
import Container from "@/components/Container";
import UserMenu from "@/components/UserMenu";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

export default async function AdminAgendaPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user || user.role !== "admin") {
    redirect("/admin");
  }

  const studio = await getStudioContent();
  const createdAtLabel = user.createdAt.toLocaleString("es-AR");

  const slots = await prisma.availabilitySlot.findMany({
    orderBy: { start: "asc" },
  });

  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
  });

  const slotsForPanel = slots.map((slot) => ({
    id: slot.id,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    status: slot.status as "available" | "blocked" | "booked",
  }));

  const slotById = new Map(slots.map((slot) => [slot.id, slot]));

  const bookingsForPanel = bookings.flatMap((booking) => {
    const slotIds = (() => {
      try {
        return JSON.parse(booking.slotIds || "[]") as string[];
      } catch {
        return [];
      }
    })();

    const extrasLabel = (() => {
      try {
        const extras = JSON.parse(booking.extras || "[]") as string[];
        return extras.length ? `Extras: ${extras.join(", ")}` : "Sin extras";
      } catch {
        return "Sin extras";
      }
    })();

    if (!slotIds.length && booking.slotId) {
      slotIds.push(booking.slotId);
    }

    return slotIds
      .map((slotId, index) => {
        const slot = slotById.get(slotId);
        if (!slot) return undefined;
        return {
          id: `${booking.id}-${index}`,
          title: booking.name,
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          status: booking.status,
          email: booking.email,
          phone: booking.phone,
          extrasLabel,
          totalLabel: `$${booking.total.toLocaleString("es-AR")}`,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  });

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
          <div className="flex items-center gap-6">
            <Link
              className="text-sm font-semibold uppercase tracking-wide text-fg/80 transition hover:text-fg"
              href="/admin"
            >
              Panel
            </Link>
            <UserMenu
              user={{
                email: user.email,
                roleLabel: "Administrador",
                id: user.id,
                createdAtLabel,
              }}
            />
          </div>
        </Container>
      </header>

      <main className="px-6 py-16">
        <Container>
          <AdminAgendaPanel slots={slotsForPanel} bookings={bookingsForPanel} />
        </Container>
      </main>
    </div>
  );
}

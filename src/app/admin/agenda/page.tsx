import Link from "next/link";
import { redirect } from "next/navigation";
import AdminAgendaPanel from "@/components/AdminAgendaPanel";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
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

  const slotsForPanel: {
    id: string;
    start: string;
    end: string;
    status: "available" | "booked";
  }[] = slots.map((slot) => ({
    id: slot.id,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    status: slot.status === "booked" ? "booked" : "available",
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
    <div className="admin-dashboard min-h-screen bg-bg text-fg">
      <header className="relative z-50 border-b border-accent/20 bg-bg/95 backdrop-blur">
        <Container className="flex items-center justify-between gap-2.5 px-3 py-2.5 sm:px-6 md:py-4">
          <div className="min-w-0 flex items-center">
            <div className="md:hidden">
              <BrandMark
                studio={studio}
                size={36}
                wordmarkScale={0.9}
                gapClassName="gap-2 sm:gap-2.5"
                className="max-w-[58vw] sm:max-w-full"
              />
            </div>
            <div className="hidden md:block">
              <BrandMark studio={studio} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:gap-4">
            <Link
              className="hidden md:inline-flex h-10 items-center justify-center rounded-full border border-accent/35 bg-accent/10 px-6 text-center text-base font-semibold leading-none tracking-wide text-accent transition hover:border-accent hover:bg-accent/20"
              href="/admin"
            >
              Panel
            </Link>
            <ThemeToggle className="h-9 w-9 md:h-10 md:w-10" />
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

      <main className="px-2 py-16 sm:px-6">
        <Container className="!px-2 sm:!px-6">
          <AdminAgendaPanel slots={slotsForPanel} bookings={bookingsForPanel} />
        </Container>
      </main>
    </div>
  );
}

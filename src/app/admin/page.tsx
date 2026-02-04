import Link from "next/link";
import { redirect } from "next/navigation";
import Container from "@/components/Container";
import UserMenu from "@/components/UserMenu";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
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

  const isAdmin = user.role === "admin";
  const roleLabel = isAdmin ? "Administrador" : "Usuario";
  const createdAtLabel = user.createdAt.toLocaleString("es-AR");

  if (!isAdmin) {
    redirect("/account");
  }

  const studio = await getStudioContent();
  const metric = await prisma.siteMetric.findUnique({
    where: { id: "global" },
  });

  const [totalUsers, totalBookings, paidBookings, pendingBookings, hoursAgg] =
    await Promise.all([
      prisma.user.count(),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: "paid" } }),
      prisma.booking.count({ where: { status: "pending_payment" } }),
      prisma.booking.aggregate({ _sum: { hours: true } }),
    ]);

  const totalVisits = metric?.visits ?? 0;
  const totalHours = hoursAgg._sum.hours ?? 0;

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
          <UserMenu
            user={{
              email: user.email,
              roleLabel,
              id: user.id,
              createdAtLabel,
            }}
          />
        </Container>
      </header>

      <main className="px-6 py-16">
        <Container>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-accent/20 bg-white/70 p-5 shadow-[0_24px_50px_-40px_rgba(30,15,20,0.5)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                Visitas
              </p>
              <p className="mt-3 font-display text-3xl uppercase tracking-[0.08em] text-fg">
                {totalVisits}
              </p>
              <p className="mt-1 text-xs text-muted">Acumuladas.</p>
            </div>
            <div className="rounded-2xl border border-accent/20 bg-white/70 p-5 shadow-[0_24px_50px_-40px_rgba(30,15,20,0.5)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                Usuarios
              </p>
              <p className="mt-3 font-display text-3xl uppercase tracking-[0.08em] text-fg">
                {totalUsers}
              </p>
              <p className="mt-1 text-xs text-muted">Registrados totales</p>
            </div>
            <div className="rounded-2xl border border-accent/20 bg-white/70 p-5 shadow-[0_24px_50px_-40px_rgba(30,15,20,0.5)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                Reservas
              </p>
              <p className="mt-3 font-display text-3xl uppercase tracking-[0.08em] text-fg">
                {totalBookings}
              </p>
              <p className="mt-1 text-xs text-muted">Totales</p>
            </div>
            <div className="rounded-2xl border border-accent/20 bg-white/70 p-5 shadow-[0_24px_50px_-40px_rgba(30,15,20,0.5)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                Pagadas
              </p>
              <p className="mt-3 font-display text-3xl uppercase tracking-[0.08em] text-fg">
                {paidBookings}
              </p>
              <p className="mt-1 text-xs text-muted">Confirmadas</p>
            </div>
            <div className="rounded-2xl border border-accent/20 bg-white/70 p-5 shadow-[0_24px_50px_-40px_rgba(30,15,20,0.5)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                Horas
              </p>
              <p className="mt-3 font-display text-3xl uppercase tracking-[0.08em] text-fg">
                {totalHours}
              </p>
              <p className="mt-1 text-xs text-muted">
                Pendientes: {pendingBookings}
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="mt-8 rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
              <div className="flex min-h-[220px] flex-wrap items-center justify-center gap-3">
                <Link
                  className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
                  href="/admin/users"
                >
                  Ver usuarios
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-full border border-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-accent transition hover:border-accent2 hover:text-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
                  href="/admin/content"
                >
                  Editar contenido
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-full border border-accent/40 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-accent transition hover:border-accent2 hover:text-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
                  href="/admin/agenda"
                >
                  Gestionar agenda
                </Link>
              </div>
            </div>
          )}
        </Container>
      </main>
    </div>
  );
}

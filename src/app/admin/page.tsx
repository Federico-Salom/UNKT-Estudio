import Link from "next/link";
import { redirect } from "next/navigation";
import BrandMark from "@/components/BrandMark";
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

  const [
    totalUsers,
    totalBookings,
    paidBookings,
    pendingBookings,
    hoursAgg,
    totalRevenueAgg,
    paidRevenueAgg,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "paid" } }),
    prisma.booking.count({ where: { status: "pending_payment" } }),
    prisma.booking.aggregate({ _sum: { hours: true } }),
    prisma.booking.aggregate({ _sum: { total: true } }),
    prisma.booking.aggregate({ _sum: { total: true }, where: { status: "paid" } }),
  ]);

  const totalVisits = metric?.visits ?? 0;
  const totalHours = hoursAgg._sum.hours ?? 0;
  const totalRevenue = totalRevenueAgg._sum.total ?? 0;
  const paidRevenue = paidRevenueAgg._sum.total ?? 0;
  const paidRevenueDisplay = paidRevenue || totalRevenue;
  const avgTicket = totalBookings ? Math.round(totalRevenue / totalBookings) : 0;

  const rangeStart = new Date();
  rangeStart.setHours(0, 0, 0, 0);
  rangeStart.setDate(rangeStart.getDate() - 6);

  const bookingsRange = await prisma.booking.findMany({
    where: { createdAt: { gte: rangeStart } },
    select: { createdAt: true, total: true },
  });

  const dayBuckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(rangeStart);
    date.setDate(rangeStart.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { date, key, count: 0, revenue: 0 };
  });

  const bucketMap = new Map(dayBuckets.map((bucket) => [bucket.key, bucket]));

  bookingsRange.forEach((booking) => {
    const key = booking.createdAt.toISOString().slice(0, 10);
    const bucket = bucketMap.get(key);
    if (!bucket) return;
    bucket.count += 1;
    bucket.revenue += booking.total;
  });

  const maxCount = Math.max(1, ...dayBuckets.map((bucket) => bucket.count));
  const maxRevenue = Math.max(1, ...dayBuckets.map((bucket) => bucket.revenue));
  const dayLabel = new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-accent/20 bg-bg/95">
        <Container className="flex items-center justify-between py-4">
          <BrandMark studio={studio} />
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
          {isAdmin && (
            <div className="rounded-3xl border border-accent/20 bg-white/70 p-5 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
                  href="/admin/users"
                >
                  Ver usuarios
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-full border border-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent2 hover:text-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
                  href="/admin/content"
                >
                  Editar contenido
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-full border border-accent/40 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent2 hover:text-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
                  href="/admin/agenda"
                >
                  Gestionar agenda
                </Link>
              </div>
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                Pagado
              </p>
              <p className="mt-3 font-display text-3xl uppercase tracking-[0.08em] text-fg">
                ${paidRevenueDisplay.toLocaleString("es-AR")}
              </p>
              <p className="mt-1 text-xs text-muted">Ingresos cobrados</p>
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

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-accent/20 bg-white/70 p-6 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                    Reservas
                  </p>
                  <h3 className="mt-2 font-display text-2xl uppercase tracking-[0.12em] text-fg">
                    Ultimos 7 dias
                  </h3>
                </div>
                <span className="text-xs text-muted">{totalBookings} total</span>
              </div>
              <div className="mt-6 grid grid-cols-7 items-end gap-2">
                {dayBuckets.map((bucket) => (
                  <div key={`count-${bucket.key}`} className="group flex flex-col items-center gap-2">
                    <div className="relative flex w-full items-end justify-center">
                      <div
                        className="h-full w-full rounded-full bg-accent/80 transition hover:bg-accent"
                        style={{ height: `${Math.max(10, (bucket.count / maxCount) * 140)}px` }}
                        title={`${bucket.count} reservas`}
                      />
                      <div className="pointer-events-none absolute -top-8 whitespace-nowrap rounded-full border border-accent/30 bg-bg/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent opacity-0 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.45)] transition group-hover:opacity-100">
                        {bucket.count} reservas
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-muted">
                      {dayLabel.format(bucket.date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-accent/20 bg-white/70 p-6 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                    Ingresos
                  </p>
                  <h3 className="mt-2 font-display text-2xl uppercase tracking-[0.12em] text-fg">
                    Ultimos 7 dias
                  </h3>
                </div>
                <span className="text-xs text-muted">
                  Pagados: ${paidRevenueDisplay.toLocaleString("es-AR")}
                </span>
              </div>
              <div className="mt-6 grid grid-cols-7 items-end gap-2">
                {dayBuckets.map((bucket) => (
                  <div key={`rev-${bucket.key}`} className="group flex flex-col items-center gap-2">
                    <div className="relative flex w-full items-end justify-center">
                      <div
                        className="h-full w-full rounded-full bg-accent/50 transition hover:bg-accent/70"
                        style={{
                          height: `${Math.max(10, (bucket.revenue / maxRevenue) * 140)}px`,
                        }}
                        title={`$${bucket.revenue.toLocaleString("es-AR")}`}
                      />
                      <div className="pointer-events-none absolute -top-8 whitespace-nowrap rounded-full border border-accent/30 bg-bg/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent opacity-0 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.45)] transition group-hover:opacity-100">
                        ${bucket.revenue.toLocaleString("es-AR")} ingresos
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-muted">
                      {dayLabel.format(bucket.date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}

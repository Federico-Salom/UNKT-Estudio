import Link from "next/link";
import { redirect } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

type DashboardPeriod = "week" | "month" | "year";

type AdminPageProps = {
  searchParams?: Promise<{
    period?: string | string[];
  }>;
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const startOfMonth = (date: Date) => {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
};

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const addMonths = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolvedSearchParams = await searchParams;
  const periodParam = Array.isArray(resolvedSearchParams?.period)
    ? resolvedSearchParams?.period[0]
    : resolvedSearchParams?.period;
  const selectedPeriod: DashboardPeriod =
    periodParam === "month" || periodParam === "year" ? periodParam : "week";

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

  const now = new Date();
  const dayLabel = new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  const monthLabel = new Intl.DateTimeFormat("es-AR", {
    month: "short",
  });

  const buckets: {
    key: string;
    label: string;
    start: Date;
    end: Date;
    count: number;
    revenue: number;
  }[] = [];

  let periodTitle = "Ultimos 7 dias";
  let rangeStart: Date;
  let rangeEnd: Date;

  if (selectedPeriod === "month") {
    periodTitle = "Mes actual";
    rangeStart = startOfMonth(now);
    rangeEnd = addMonths(rangeStart, 1);
    let cursor = new Date(rangeStart);
    let weekIndex = 1;
    while (cursor < rangeEnd) {
      const bucketStart = new Date(cursor);
      const bucketEnd = addDays(bucketStart, 7);
      const clampedEnd = bucketEnd < rangeEnd ? bucketEnd : rangeEnd;
      buckets.push({
        key: `${bucketStart.toISOString()}-${clampedEnd.toISOString()}`,
        label: `Sem ${weekIndex}`,
        start: bucketStart,
        end: clampedEnd,
        count: 0,
        revenue: 0,
      });
      cursor = clampedEnd;
      weekIndex += 1;
    }
  } else if (selectedPeriod === "year") {
    periodTitle = "A\u00f1o actual";
    rangeStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    rangeEnd = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
    for (let month = 0; month < 12; month += 1) {
      const bucketStart = new Date(now.getFullYear(), month, 1, 0, 0, 0, 0);
      const bucketEnd = new Date(now.getFullYear(), month + 1, 1, 0, 0, 0, 0);
      buckets.push({
        key: `${now.getFullYear()}-${String(month + 1).padStart(2, "0")}`,
        label: monthLabel.format(bucketStart),
        start: bucketStart,
        end: bucketEnd,
        count: 0,
        revenue: 0,
      });
    }
  } else {
    periodTitle = "Ultimos 7 dias";
    rangeEnd = addDays(startOfDay(now), 1);
    rangeStart = addDays(rangeEnd, -7);
    for (let index = 0; index < 7; index += 1) {
      const bucketStart = addDays(rangeStart, index);
      const bucketEnd = addDays(bucketStart, 1);
      buckets.push({
        key: bucketStart.toISOString().slice(0, 10),
        label: dayLabel.format(bucketStart),
        start: bucketStart,
        end: bucketEnd,
        count: 0,
        revenue: 0,
      });
    }
  }

  const bookingsRange = await prisma.booking.findMany({
    where: {
      createdAt: {
        gte: rangeStart,
        lt: rangeEnd,
      },
    },
    select: { createdAt: true, total: true, status: true },
  });

  bookingsRange.forEach((booking) => {
    const time = booking.createdAt.getTime();
    const bucket = buckets.find(
      (item) => time >= item.start.getTime() && time < item.end.getTime()
    );
    if (!bucket) return;
    bucket.count += 1;
    if (booking.status === "paid") {
      bucket.revenue += booking.total;
    }
  });

  const rangeBookingsTotal = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const rangePaidRevenue = buckets.reduce((sum, bucket) => sum + bucket.revenue, 0);
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const maxRevenue = Math.max(1, ...buckets.map((bucket) => bucket.revenue));
return (
    <div className="admin-dashboard min-h-screen bg-bg text-fg">
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

          <div className="mt-8 rounded-3xl border border-accent/20 bg-white/70 p-4 shadow-[0_24px_50px_-40px_rgba(30,15,20,0.5)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                Vista de datos
              </p>
              <div className="inline-flex items-center rounded-full border border-accent/25 bg-white/80 p-1">
                {([
                  { key: "week", label: "Semana" },
                  { key: "month", label: "Mes" },
                  { key: "year", label: "A\u00f1o" },
                ] as { key: DashboardPeriod; label: string }[]).map((option) => {
                  const active = selectedPeriod === option.key;
                  const href =
                    option.key === "week" ? "/admin" : `/admin?period=${option.key}`;
                  return (
                    <Link
                      key={option.key}
                      href={href}
                      className={`rounded-full px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition ${
                        active
                          ? "bg-accent text-bg shadow-[0_8px_16px_-12px_rgba(139,13,90,0.9)]"
                          : "text-muted hover:bg-accent/10"
                      }`}
                    >
                      {option.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

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
                    {periodTitle}
                  </h3>
                </div>
                <span className="text-xs text-muted">{rangeBookingsTotal} total</span>
              </div>
              <div
                className="mt-6 grid items-end gap-2"
                style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
              >
                {buckets.map((bucket) => (
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
                      {bucket.label}
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
                    {periodTitle}
                  </h3>
                </div>
                <span className="text-xs text-muted">
                  Pagados: ${rangePaidRevenue.toLocaleString("es-AR")}
                </span>
              </div>
              <div
                className="mt-6 grid items-end gap-2"
                style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
              >
                {buckets.map((bucket) => (
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
                      {bucket.label}
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


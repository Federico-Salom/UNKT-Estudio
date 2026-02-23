import Link from "next/link";
import { redirect } from "next/navigation";
import AdminMetricsCarousel from "@/components/AdminMetricsCarousel";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

type DashboardPeriod = "week" | "month" | "year";
type DashboardChart = "bookings" | "revenue";

type AdminPageProps = {
  searchParams?: Promise<{
    period?: string | string[];
    chart?: string | string[];
    offset?: string | string[];
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

const addYears = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + amount);
  return next;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

export default async function AdminMetricasPage({ searchParams }: AdminPageProps) {
  const resolvedSearchParams = await searchParams;
  const periodParam = Array.isArray(resolvedSearchParams?.period)
    ? resolvedSearchParams?.period[0]
    : resolvedSearchParams?.period;
  const selectedPeriod: DashboardPeriod =
    periodParam === "month" || periodParam === "year" ? periodParam : "week";
  const chartParam = Array.isArray(resolvedSearchParams?.chart)
    ? resolvedSearchParams?.chart[0]
    : resolvedSearchParams?.chart;
  const selectedChart: DashboardChart = chartParam === "revenue" ? "revenue" : "bookings";
  const offsetParam = Array.isArray(resolvedSearchParams?.offset)
    ? resolvedSearchParams?.offset[0]
    : resolvedSearchParams?.offset;
  const parsedOffset = Number.parseInt(offsetParam ?? "0", 10);
  const selectedOffset = Number.isFinite(parsedOffset) ? clamp(parsedOffset, -120, 0) : 0;

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

  const createdAtLabel = user.createdAt.toLocaleString("es-AR");

  if (user.role !== "admin") {
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
  const pendingRevenue = Math.max(totalRevenue - paidRevenue, 0);
  const paidRate = totalBookings > 0 ? (paidBookings / totalBookings) * 100 : 0;
  const visitToBookingRate = totalVisits > 0 ? (totalBookings / totalVisits) * 100 : 0;
  const averageTicket = totalBookings > 0 ? totalRevenue / totalBookings : 0;
  const averagePaidTicket = paidBookings > 0 ? paidRevenue / paidBookings : 0;
  const averageHoursPerBooking = totalBookings > 0 ? totalHours / totalBookings : 0;
  const dashboardMetrics = [
    {
      label: "Visitas",
      value: String(totalVisits),
      detail: "Acumuladas.",
    },
    {
      label: "Usuarios",
      value: String(totalUsers),
      detail: "Registrados totales",
    },
    {
      label: "Reservas",
      value: String(totalBookings),
      detail: "Totales",
    },
    {
      label: "Pagado",
      value: `$${paidRevenueDisplay.toLocaleString("es-AR")}`,
      detail: "Ingresos cobrados",
    },
    {
      label: "Horas",
      value: String(totalHours),
      detail: `Pendientes: ${pendingBookings}`,
    },
  ];
  const extraMetrics = [
    {
      label: "Pagadas",
      value: `${paidBookings}`,
      detail: `${paidRate.toFixed(1)}% del total`,
    },
    {
      label: "Pendientes",
      value: `${pendingBookings}`,
      detail: `$${pendingRevenue.toLocaleString("es-AR")} sin cobrar`,
    },
    {
      label: "Ticket prom.",
      value: `$${Math.round(averageTicket).toLocaleString("es-AR")}`,
      detail: "Promedio por reserva",
    },
    {
      label: "Ticket pagado",
      value: `$${Math.round(averagePaidTicket).toLocaleString("es-AR")}`,
      detail: "Promedio reservas pagadas",
    },
    {
      label: "Horas/reserva",
      value: averageHoursPerBooking.toFixed(2),
      detail: "Promedio historico",
    },
    {
      label: "Conversion",
      value: `${visitToBookingRate.toFixed(1)}%`,
      detail: "Visitas a reserva",
    },
  ];
  const carouselMetrics = [...dashboardMetrics, ...extraMetrics];

  const now = new Date();
  const dayLabel = new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  const monthLabel = new Intl.DateTimeFormat("es-AR", {
    month: "short",
  });
  const monthYearLabel = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  });
  const dateRangeLabel = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const capitalizeLabel = (value: string) => {
    if (!value) return value;
    return value[0].toUpperCase() + value.slice(1);
  };

  const buckets: {
    key: string;
    label: string;
    start: Date;
    end: Date;
    count: number;
    revenue: number;
    totalRevenue: number;
  }[] = [];

  let periodTitle = "Últimos 7 días";
  let periodSubtitle = "";
  let rangeStart: Date;
  let rangeEnd: Date;

  const anchorDate =
    selectedPeriod === "month"
      ? addMonths(now, selectedOffset)
      : selectedPeriod === "year"
        ? addYears(now, selectedOffset)
        : addDays(now, selectedOffset * 7);

  if (selectedPeriod === "month") {
    periodTitle = "Mes";
    rangeStart = startOfMonth(anchorDate);
    rangeEnd = addMonths(rangeStart, 1);
    periodSubtitle = capitalizeLabel(monthYearLabel.format(rangeStart));
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
        totalRevenue: 0,
      });
      cursor = clampedEnd;
      weekIndex += 1;
    }
  } else if (selectedPeriod === "year") {
    const selectedYear = anchorDate.getFullYear();
    periodTitle = "Año";
    periodSubtitle = String(selectedYear);
    rangeStart = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
    rangeEnd = new Date(selectedYear + 1, 0, 1, 0, 0, 0, 0);
    for (let month = 0; month < 12; month += 1) {
      const bucketStart = new Date(selectedYear, month, 1, 0, 0, 0, 0);
      const bucketEnd = new Date(selectedYear, month + 1, 1, 0, 0, 0, 0);
      const shortMonthLabel = monthLabel.format(bucketStart).replace(".", "");
      buckets.push({
        key: `${selectedYear}-${String(month + 1).padStart(2, "0")}`,
        label: capitalizeLabel(shortMonthLabel),
        start: bucketStart,
        end: bucketEnd,
        count: 0,
        revenue: 0,
        totalRevenue: 0,
      });
    }
  } else {
    periodTitle = "Semana";
    rangeEnd = addDays(startOfDay(anchorDate), 1);
    rangeStart = addDays(rangeEnd, -7);
    const weekEnd = addDays(rangeEnd, -1);
    periodSubtitle = `${capitalizeLabel(dateRangeLabel.format(rangeStart))} - ${capitalizeLabel(
      dateRangeLabel.format(weekEnd)
    )}`;
    for (let index = 0; index < 7; index += 1) {
      const bucketStart = addDays(rangeStart, index);
      const bucketEnd = addDays(bucketStart, 1);
      buckets.push({
        key: bucketStart.toISOString().slice(0, 10),
        label: capitalizeLabel(dayLabel.format(bucketStart)),
        start: bucketStart,
        end: bucketEnd,
        count: 0,
        revenue: 0,
        totalRevenue: 0,
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
    bucket.totalRevenue += booking.total;
    if (booking.status === "paid") {
      bucket.revenue += booking.total;
    }
  });

  const rangeBookingsTotal = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const rangePaidRevenue = buckets.reduce((sum, bucket) => sum + bucket.revenue, 0);
  const rangeTotalRevenue = buckets.reduce((sum, bucket) => sum + bucket.totalRevenue, 0);
  const showTotalRevenueFallback = rangePaidRevenue === 0 && rangeTotalRevenue > 0;
  const rangeRevenueDisplay = showTotalRevenueFallback ? rangeTotalRevenue : rangePaidRevenue;
  const rangeRevenueLabel = showTotalRevenueFallback ? "Totales" : "Pagados";
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const maxRevenue = Math.max(
    1,
    ...buckets.map((bucket) =>
      showTotalRevenueFallback ? bucket.totalRevenue : bucket.revenue
    )
  );
  const isWeekView = selectedPeriod === "week";
  const isYearView = selectedPeriod === "year";
  const chartBarMaxHeight = isYearView ? 170 : 140;
  const chartBarMinHeight = isYearView ? 14 : 10;
  const chartColumnMinWidth = isYearView ? "2.8rem" : "0";
  const chartGridMinWidthClassName = isYearView ? "min-w-[38rem]" : "";
  const getBarHeight = (value: number, maxValue: number) => {
    if (value <= 0) return 4;
    return Math.max(chartBarMinHeight, (value / maxValue) * chartBarMaxHeight);
  };
  const canGoBackward = selectedOffset > -120;
  const canGoForward = selectedOffset < 0;
  const periodOptions: { key: DashboardPeriod; label: string }[] = [
    { key: "week", label: "Semana" },
    { key: "month", label: "Mes" },
    { key: "year", label: "Año" },
  ];
  const chartOptions: { key: DashboardChart; label: string }[] = [
    { key: "bookings", label: "Reservas" },
    { key: "revenue", label: "Ingresos" },
  ];

  const resolveDashboardHref = (
    period: DashboardPeriod,
    chart: DashboardChart,
    offset = selectedOffset
  ) => {
    const params = new URLSearchParams();
    if (period !== "week") params.set("period", period);
    if (chart !== "bookings") params.set("chart", chart);
    if (offset !== 0) params.set("offset", String(offset));
    const query = params.toString();
    return query ? `/admin/metricas?${query}` : "/admin/metricas";
  };

  return (
    <div className="admin-dashboard min-h-screen bg-bg text-fg">
      <header className="relative z-50 border-b border-accent/20 bg-bg/95 backdrop-blur">
        <Container className="flex items-center justify-between gap-2.5 px-3 py-2.5 sm:px-6 md:py-4">
          <div className="min-w-0 flex items-center">
            <div className="md:hidden">
              <BrandMark
                studio={studio}
                size={36}
                showText={false}
                wordmarkScale={0.9}
                gapClassName="gap-2 sm:gap-2.5"
                className="max-w-[58vw] sm:max-w-full"
              />
            </div>
            <div className="hidden md:block">
              <BrandMark studio={studio} showText={false} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:gap-4">
            <Link
              className="inline-flex h-9 items-center justify-center rounded-full border border-accent/35 bg-accent/10 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/20 md:h-10 md:px-5"
              href="/admin"
            >
              Gestion
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

      <main className="px-6 pb-16 pt-0">
        <Container>
          <AdminMetricsCarousel metrics={carouselMetrics} />

          <div className="mt-8 rounded-3xl border border-accent/20 bg-white/70 p-4 shadow-[0_24px_50px_-40px_rgba(30,15,20,0.5)] backdrop-blur md:hidden">
            <div>
              <div
                className="mx-auto grid h-11 w-full max-w-[18.5rem] grid-cols-3 items-center rounded-full border border-accent/25 bg-white/80 p-1"
                aria-label="Vista de datos"
              >
                {periodOptions.map((option) => {
                  const active = selectedPeriod === option.key;
                  return (
                    <Link
                      key={`mobile-${option.key}`}
                      href={resolveDashboardHref(option.key, selectedChart)}
                      scroll={false}
                      className={`inline-flex h-9 w-full items-center justify-center rounded-full px-2 text-center text-[10px] font-semibold uppercase tracking-wide transition ${
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
            <div className="mt-3">
              <div
                className="mx-auto grid h-11 w-full max-w-[18.5rem] grid-cols-2 items-center rounded-full border border-accent/25 bg-white/80 p-1"
                aria-label="Grafico"
              >
                {chartOptions.map((option) => {
                  const active = selectedChart === option.key;
                  return (
                    <Link
                      key={`mobile-chart-${option.key}`}
                      href={resolveDashboardHref(selectedPeriod, option.key)}
                      scroll={false}
                      className={`inline-flex h-9 w-full items-center justify-center rounded-full px-2 text-center text-[10px] font-semibold uppercase tracking-wide transition ${
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
            <div className="mt-3">
              <div
                className="mx-auto grid h-11 w-full max-w-[18.5rem] grid-cols-3 items-center rounded-full border border-accent/25 bg-white/80 p-1"
                aria-label="Historico"
              >
                {canGoBackward ? (
                  <Link
                    href={resolveDashboardHref(selectedPeriod, selectedChart, selectedOffset - 1)}
                    scroll={false}
                    className="inline-flex h-9 w-full items-center justify-center rounded-full px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted transition hover:bg-accent/10"
                  >
                    Anterior
                  </Link>
                ) : (
                  <span className="inline-flex h-9 w-full cursor-not-allowed items-center justify-center rounded-full px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted/60">
                    Anterior
                  </span>
                )}
                <Link
                  href={resolveDashboardHref(selectedPeriod, selectedChart, 0)}
                  scroll={false}
                  className={`inline-flex h-9 w-full items-center justify-center rounded-full px-2 text-center text-[10px] font-semibold uppercase tracking-wide transition ${
                    selectedOffset === 0
                      ? "bg-accent text-bg shadow-[0_8px_16px_-12px_rgba(139,13,90,0.9)]"
                      : "text-muted hover:bg-accent/10"
                  }`}
                >
                  Hoy
                </Link>
                {canGoForward ? (
                  <Link
                    href={resolveDashboardHref(selectedPeriod, selectedChart, selectedOffset + 1)}
                    scroll={false}
                    className="inline-flex h-9 w-full items-center justify-center rounded-full px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted transition hover:bg-accent/10"
                  >
                    Siguiente
                  </Link>
                ) : (
                  <span className="inline-flex h-9 w-full cursor-not-allowed items-center justify-center rounded-full px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted/60">
                    Siguiente
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 hidden rounded-3xl border border-accent/20 bg-white/70 p-4 shadow-[0_24px_50px_-40px_rgba(30,15,20,0.5)] backdrop-blur md:block">
            <div className="grid grid-cols-3 items-center gap-4">
              <div
                className="inline-flex items-center rounded-full border border-accent/25 bg-white/80 p-1"
                aria-label="Vista de datos"
              >
                {periodOptions.map((option) => {
                  const active = selectedPeriod === option.key;
                  return (
                    <Link
                      key={option.key}
                      href={resolveDashboardHref(option.key, selectedChart)}
                      scroll={false}
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

              <div
                className="inline-flex items-center rounded-full border border-accent/25 bg-white/80 p-1"
                aria-label="Grafico"
              >
                {chartOptions.map((option) => {
                  const active = selectedChart === option.key;
                  return (
                    <Link
                      key={`desktop-chart-${option.key}`}
                      href={resolveDashboardHref(selectedPeriod, option.key)}
                      scroll={false}
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

              <div
                className="inline-flex items-center rounded-full border border-accent/25 bg-white/80 p-1"
                aria-label="Historico"
              >
                {canGoBackward ? (
                  <Link
                    href={resolveDashboardHref(selectedPeriod, selectedChart, selectedOffset - 1)}
                    scroll={false}
                    className="rounded-full px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted transition hover:bg-accent/10"
                  >
                    Anterior
                  </Link>
                ) : (
                  <span className="cursor-not-allowed rounded-full px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted/60">
                    Anterior
                  </span>
                )}
                <Link
                  href={resolveDashboardHref(selectedPeriod, selectedChart, 0)}
                  scroll={false}
                  className={`rounded-full px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition ${
                    selectedOffset === 0
                      ? "bg-accent text-bg shadow-[0_8px_16px_-12px_rgba(139,13,90,0.9)]"
                      : "text-muted hover:bg-accent/10"
                  }`}
                >
                  Hoy
                </Link>
                {canGoForward ? (
                  <Link
                    href={resolveDashboardHref(selectedPeriod, selectedChart, selectedOffset + 1)}
                    scroll={false}
                    className="rounded-full px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted transition hover:bg-accent/10"
                  >
                    Siguiente
                  </Link>
                ) : (
                  <span className="cursor-not-allowed rounded-full px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted/60">
                    Siguiente
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-4 md:mt-8 md:grid md:gap-4 md:space-y-0 lg:grid-cols-2">
            <div
              className={`min-h-[24rem] flex-col rounded-3xl border border-accent/20 bg-white/70 p-6 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur md:flex ${
                selectedChart === "bookings" ? "flex" : "hidden"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                    Reservas
                  </p>
                  <span className="shrink-0 text-xs text-muted">{rangeBookingsTotal} total</span>
                </div>
                {isWeekView ? (
                  <div className="pt-1 text-center">
                    <h3 className="font-display text-2xl text-fg">{periodTitle}</h3>
                    <p className="mx-auto mt-1 max-w-[13rem] text-sm leading-snug text-muted">
                      {periodSubtitle}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-display text-2xl text-fg">{periodTitle}</h3>
                    <p className="text-sm text-muted">{periodSubtitle}</p>
                  </div>
                )}
              </div>
              <div className={`mt-6 flex flex-1 items-end ${isYearView ? "overflow-x-auto pb-2" : ""}`}>
                <div
                  className={`grid h-full min-h-[12.5rem] w-full items-end gap-2 ${chartGridMinWidthClassName}`}
                  style={{
                    gridTemplateColumns: `repeat(${buckets.length}, minmax(${chartColumnMinWidth}, 1fr))`,
                  }}
                >
                  {buckets.map((bucket) => (
                    <div
                      key={`count-${bucket.key}`}
                      className="group grid h-full grid-rows-[minmax(0,1fr)_auto] items-end gap-2"
                    >
                      <div className="relative flex h-full w-full items-end justify-center">
                        <div
                          className="w-full rounded-t-[0.9rem] bg-accent/80 transition hover:bg-accent"
                          style={{ height: `${getBarHeight(bucket.count, maxCount)}px` }}
                          title={`${bucket.count} reservas`}
                        />
                        <div className="pointer-events-none absolute -top-8 whitespace-nowrap rounded-full border border-accent/30 bg-bg/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent opacity-0 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.45)] transition group-hover:opacity-100">
                          {bucket.count} reservas
                        </div>
                      </div>
                      <span
                        className={`text-muted ${
                          isYearView
                            ? "text-center text-[11px] font-medium tracking-[0.01em]"
                            : "text-[10px] uppercase tracking-wide"
                        }`}
                      >
                        {bucket.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div
              className={`min-h-[24rem] flex-col rounded-3xl border border-accent/20 bg-white/70 p-6 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur md:flex ${
                selectedChart === "revenue" ? "flex" : "hidden"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                    Ingresos
                  </p>
                  <span className="shrink-0 text-xs text-muted">
                    {rangeRevenueLabel}: ${rangeRevenueDisplay.toLocaleString("es-AR")}
                  </span>
                </div>
                {isWeekView ? (
                  <div className="pt-1 text-center">
                    <h3 className="font-display text-2xl text-fg">{periodTitle}</h3>
                    <p className="mx-auto mt-1 max-w-[13rem] text-sm leading-snug text-muted">
                      {periodSubtitle}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-display text-2xl text-fg">{periodTitle}</h3>
                    <p className="text-sm text-muted">{periodSubtitle}</p>
                  </div>
                )}
              </div>
              <div className={`mt-6 flex flex-1 items-end ${isYearView ? "overflow-x-auto pb-2" : ""}`}>
                <div
                  className={`grid h-full min-h-[12.5rem] w-full items-end gap-2 ${chartGridMinWidthClassName}`}
                  style={{
                    gridTemplateColumns: `repeat(${buckets.length}, minmax(${chartColumnMinWidth}, 1fr))`,
                  }}
                >
                  {buckets.map((bucket) => {
                    const bucketRevenue = showTotalRevenueFallback
                      ? bucket.totalRevenue
                      : bucket.revenue;

                    return (
                      <div
                        key={`rev-${bucket.key}`}
                        className="group grid h-full grid-rows-[minmax(0,1fr)_auto] items-end gap-2"
                      >
                        <div className="relative flex h-full w-full items-end justify-center">
                          <div
                            className="w-full rounded-t-[0.9rem] bg-accent/50 transition hover:bg-accent/70"
                            style={{
                              height: `${getBarHeight(bucketRevenue, maxRevenue)}px`,
                            }}
                            title={`$${bucketRevenue.toLocaleString("es-AR")}`}
                          />
                          <div className="pointer-events-none absolute -top-8 whitespace-nowrap rounded-full border border-accent/30 bg-bg/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent opacity-0 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.45)] transition group-hover:opacity-100">
                            ${bucketRevenue.toLocaleString("es-AR")} ingresos
                          </div>
                        </div>
                        <span
                          className={`text-muted ${
                            isYearView
                              ? "text-center text-[11px] font-medium tracking-[0.01em]"
                              : "text-[10px] uppercase tracking-wide"
                          }`}
                        >
                          {bucket.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}


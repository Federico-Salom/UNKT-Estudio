import Link from "next/link";
import { redirect } from "next/navigation";
import AdminMetricsCarousel from "@/components/AdminMetricsCarousel";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { getSessionFromCookies } from "@/lib/auth";
import { pruneExpiredPendingBookings } from "@/lib/booking-expiration";
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

  if (user.role !== "admin") {
    redirect("/account");
  }

  await pruneExpiredPendingBookings();

  const studio = await getStudioContent();
  const createdAtLabel = user.createdAt.toLocaleString("es-AR");
  const metric = await prisma.siteMetric.findUnique({
    where: { id: "global" },
  });

  const [
    totalUsers,
    totalBookings,
    pendingBookings,
    hoursAgg,
    totalRevenueAgg,
    paidRevenueAgg,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.booking.count(),
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
            <ThemeToggle className="h-9 w-9 md:h-10 md:w-10" />
            <UserMenu
              showHomeButton
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

      <main className="px-6 py-8">
        <Container>
          <div className="rounded-3xl border border-accent/20 bg-white/70 p-5 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
            <div className="mx-auto grid w-full max-w-[21rem] grid-cols-1 gap-3 md:max-w-none md:flex md:flex-wrap md:items-center md:justify-center">
              <Link
                className="inline-flex w-full items-center justify-center rounded-full border border-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent2 hover:text-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 md:w-auto"
                href="/admin/configuracion"
              >
                Configuración
              </Link>
              <Link
                className="inline-flex w-full items-center justify-center rounded-full border border-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent2 hover:text-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 md:w-auto"
                href="/admin/metricas"
              >
                Métricas
              </Link>
              <Link
                className="inline-flex w-full items-center justify-center rounded-full border border-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent2 hover:text-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 md:w-auto"
                href="/mis-reservas"
              >
                Mis reservas
              </Link>
              <Link
                className="inline-flex w-full items-center justify-center rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 md:w-auto"
                href="/admin/agenda"
              >
                Gestionar agenda
              </Link>
            </div>
          </div>

          <AdminMetricsCarousel metrics={dashboardMetrics} />
        </Container>
      </main>
    </div>
  );
}

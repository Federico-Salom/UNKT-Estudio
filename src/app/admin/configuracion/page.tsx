import Link from "next/link";
import { redirect } from "next/navigation";
import AdminPricingModal from "@/components/AdminPricingModal";
import AdminAgendaHelpButton from "@/components/AdminAgendaHelpButton";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { getSessionFromCookies } from "@/lib/auth";
import { normalizeExtraBackgrounds, resolveBasePrice } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

export default async function AdminConfiguracionPage() {
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
  const pricingBasePrice = resolveBasePrice(studio.pricing.basePrice);
  const pricingExtras = normalizeExtraBackgrounds(studio.extras.backgrounds);

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

      <main className="px-6 py-8">
        <Container>
          <div className="rounded-3xl border border-accent/20 bg-white/70 p-5 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
            <section
              aria-label="Opciones de configuración"
              className="mx-auto max-w-[21rem] md:max-w-none"
            >
              <div className="grid grid-cols-1 gap-3 md:flex md:flex-wrap md:items-center md:justify-center">
                <Link
                  className="inline-flex w-full items-center justify-center rounded-full border border-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent2 hover:text-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 md:w-auto"
                  href="/admin/users"
                >
                  Ver usuarios
                </Link>
                <Link
                  className="inline-flex w-full items-center justify-center rounded-full border border-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent2 hover:text-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 md:w-auto"
                  href="/admin/content"
                >
                  Editar contenido
                </Link>
                <AdminAgendaHelpButton />
                <AdminPricingModal
                  basePrice={pricingBasePrice}
                  extras={pricingExtras}
                  triggerClassName="w-full md:w-auto"
                />
              </div>
            </section>
          </div>
        </Container>
      </main>
    </div>
  );
}

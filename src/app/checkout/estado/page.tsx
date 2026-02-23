import Link from "next/link";
import { redirect } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import StatusScreenBrick from "@/components/mercadopago/StatusScreenBrick";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

type CheckoutStatusPageProps = {
  searchParams?: Promise<{
    payment_id?: string | string[];
    collection_id?: string | string[];
  }>;
};

const getFirstParamValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const normalizePaymentParam = (value: string | string[] | undefined) => {
  const raw = getFirstParamValue(value)?.trim();
  if (!raw) return null;

  const lowered = raw.toLowerCase();
  if (lowered === "null" || lowered === "undefined" || lowered === "nan") {
    return null;
  }

  return raw;
};

export default async function CheckoutStatusPage({
  searchParams,
}: CheckoutStatusPageProps) {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const paymentId =
    normalizePaymentParam(resolvedSearchParams?.payment_id) ??
    normalizePaymentParam(resolvedSearchParams?.collection_id);
  const [studio, user] = await Promise.all([
    getStudioContent(),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
  ]);

  if (!user) {
    redirect("/login");
  }

  const roleLabel = user.role === "admin" ? "Administrador" : "Usuario";
  const createdAtLabel = user.createdAt.toLocaleString("es-AR");
  const userMenuData = {
    email: user.email,
    roleLabel,
    id: user.id,
    createdAtLabel,
  };

  const header = (
    <header className="border-b border-accent/20 bg-bg/95 backdrop-blur">
      <div className="flex w-full items-center justify-between gap-2.5 px-3 py-2.5 sm:px-6 sm:py-4 lg:px-8">
        <div className="sm:hidden">
          <BrandMark studio={studio} showText={false} size={36} />
        </div>
        <div className="hidden sm:block">
          <BrandMark studio={studio} />
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Link
            href="/mis-reservas"
            className="inline-flex h-9 items-center justify-center rounded-full border border-accent/35 bg-accent/10 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent transition hover:border-accent hover:bg-accent/20 sm:px-4 sm:text-xs md:h-10"
          >
            <span className="sm:hidden">Reservas</span>
            <span className="hidden sm:inline">Mis reservas</span>
          </Link>
          <ThemeToggle className="h-9 w-9 md:h-10 md:w-10" />
          <UserMenu
            triggerClassName="h-9 w-9 md:h-10 md:w-10"
            user={userMenuData}
          />
        </div>
      </div>
    </header>
  );

  const hasPaymentId = Boolean(paymentId);

  return (
    <div className="auth-page checkout-page min-h-screen bg-bg text-fg">
      {header}

      <main className="w-full px-3 py-8 sm:px-6 sm:py-12 lg:px-8">
        <section className="checkout-frame w-full p-3 sm:p-4 lg:p-5">
          <div className="checkout-layout flex w-full flex-col gap-5">
            <header className="checkout-hero checkout-status-hero relative isolate overflow-hidden rounded-[1.9rem] px-5 py-6 sm:px-7 sm:py-7">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_-12%,rgba(214,36,80,0.5),transparent_62%)] opacity-75"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-60 blur-[1px]"
              />

              <div className="relative flex items-start justify-between gap-3">
                <p className="checkout-kicker whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-muted [overflow-wrap:normal] [word-break:normal]">
                  Checkout
                </p>
                <span className="checkout-status-pill border-fg/20 bg-bg/70 text-fg">
                  {hasPaymentId ? "Consulta activa" : "Payment id faltante"}
                </span>
              </div>

              <div className="relative mt-3 w-full text-left">
                <h1 className="checkout-status-title font-display text-2xl leading-tight sm:text-3xl">
                  Estado del pago
                </h1>
                <p className="checkout-status-description mt-2 text-sm text-muted">
                  {hasPaymentId
                    ? "Revisa el resultado de la transaccion y su estado registrado."
                    : "No recibimos payment_id. Vuelve a Mis reservas para generar uno desde una reserva pendiente."}
                </p>
                <div className="mt-3 h-px w-16 rounded-full bg-gradient-to-r from-accent/80 via-accent/40 to-transparent" />
              </div>
            </header>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:gap-5">
              <article className="checkout-panel flex h-full flex-col rounded-3xl p-4 sm:p-5">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-fg/80">
                  Información
                </h2>
                <p className="mt-2 text-sm text-muted">
                  {hasPaymentId
                    ? "Mercado Pago actualiza el estado en tiempo real. Puedes refrescar esta página en cualquier momento."
                    : "Sin payment_id no podemos consultar el estado. Generalo desde Mis reservas con la reserva que quieras pagar."}
                </p>

                <div className="checkout-summary-item mt-4 rounded-2xl px-4 py-3 text-sm text-fg/80">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
                    ID de pago
                  </p>
                  <p className="mt-1 font-mono text-xs text-fg">
                    {paymentId ?? "-"}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.12em]">
                  <Link
                    href="/mis-reservas"
                    className="inline-flex items-center rounded-full border border-accent/35 bg-accent/10 px-4 py-2 font-semibold text-accent transition hover:border-accent hover:bg-accent/20"
                  >
                    Mis reservas
                  </Link>
                  <span className="inline-flex items-center rounded-full border border-fg/20 bg-bg/70 px-4 py-2 font-semibold text-fg">
                    {hasPaymentId ? "Mercado Pago" : "Esperando datos"}
                  </span>
                </div>
              </article>

              <article className="checkout-panel flex h-full flex-col rounded-3xl p-4 sm:p-5">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-fg/80">
                  Estado oficial
                </h2>
                <p className="mt-2 text-sm text-muted">
                  {hasPaymentId
                    ? "El Status Screen Brick muestra como Mercado Pago ve la operacion."
                    : "Mostraremos esta pantalla apenas tengas un payment_id válido."}
                </p>

                <div className="mt-4 flex flex-1 flex-col">
                  {hasPaymentId ? (
                    <div className="flex-1">
                      <StatusScreenBrick paymentId={paymentId!} />
                    </div>
                  ) : (
                    <div className="checkout-summary-item flex flex-1 flex-col justify-center gap-3 rounded-2xl px-4 py-5 text-sm text-muted">
                      <p>No podemos mostrar el estado sin un payment_id.</p>
                      <p>
                        Vuelve a Mis reservas y haz click en una reserva
                        pendiente para generar el token.
                      </p>
                    </div>
                  )}
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import StatusScreenBrick from "@/components/mercadopago/StatusScreenBrick";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

type CheckoutStatusPageProps = {
  searchParams?: Promise<{ payment_id?: string | string[] }>;
};

const getFirstParamValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function CheckoutStatusPage({
  searchParams,
}: CheckoutStatusPageProps) {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const paymentId = getFirstParamValue(resolvedSearchParams?.payment_id)?.trim();
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

  return (
    <div className="auth-page min-h-screen bg-bg text-fg">
      <header className="border-b border-accent/20 bg-bg/95">
        <Container className="flex items-center justify-between py-4">
          <BrandMark studio={studio} />
          <div className="flex items-center gap-4">
            <Link
              href="/mis-reservas"
              className="inline-flex items-center rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent transition hover:border-accent hover:bg-accent/20"
            >
              Mis reservas
            </Link>
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

      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-6 py-16">
        <section className="w-full max-w-2xl rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
          <h1 className="font-display text-3xl uppercase tracking-[0.2em]">
            Estado del pago
          </h1>
          <p className="mt-2 text-sm text-muted">
            Revisa el resultado de la transaccion en Mercado Pago.
          </p>

          {paymentId ? (
            <div className="mt-6">
              <StatusScreenBrick paymentId={paymentId} />
            </div>
          ) : (
            <div
              className="mt-6 rounded-2xl border border-accent/35 bg-accent/10 px-4 py-3 text-sm text-accent"
              role="alert"
            >
              No recibimos payment_id. Vuelve a
              {" "}&quot;Mis reservas&quot; para revisar el estado.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

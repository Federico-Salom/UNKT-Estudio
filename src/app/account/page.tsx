import { redirect } from "next/navigation";
import AccountProfileForm from "@/components/AccountProfileForm";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
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

  if (user.role === "admin") {
    redirect("/admin");
  }

  const studio = await getStudioContent();
  const createdAtLabel = user.createdAt.toLocaleString("es-AR");

  return (
    <div className="account-page min-h-screen bg-bg text-fg">
      <header className="relative z-50 border-b border-accent/20 bg-bg/95 backdrop-blur">
        <Container className="flex items-center justify-between gap-2.5 px-3 py-2.5 sm:px-6 md:py-4">
          <BrandMark studio={studio} showText={false} />
          <div className="flex items-center gap-2 md:gap-4">
            <ThemeToggle className="h-9 w-9 md:h-10 md:w-10" />
            <UserMenu
              user={{
                email: user.email,
                roleLabel: "Usuario",
                id: user.id,
                createdAtLabel,
                name: user.name ?? undefined,
              }}
            />
          </div>
        </Container>
      </header>

      <main className="px-4 py-16">
        <Container className="max-w-5xl">
          <div className="mx-auto w-full max-w-3xl">
            <section className="rounded-[2.5rem] border border-accent/20 bg-bg/90 p-10 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur-xl">
              <header className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.5em] text-muted">
                  Cuenta
                </p>
                <h1 className="font-display text-3xl uppercase tracking-[0.2em] text-fg">
                  Perfil
                </h1>
                <p className="text-sm text-muted">
                  Edita mail, nombre, teléfono y contraseña.
                </p>
              </header>

              <AccountProfileForm
                initialEmail={user.email}
                initialName={user.name ?? ""}
                initialPhone={user.phone ?? ""}
              />
            </section>
          </div>
        </Container>
      </main>
    </div>
  );
}

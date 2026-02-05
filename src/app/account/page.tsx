import { redirect } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
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
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-accent/20 bg-bg/95">
        <Container className="flex items-center justify-between py-4">
          <BrandMark studio={studio} />
          <UserMenu
            user={{
              email: user.email,
              roleLabel: "Usuario",
              id: user.id,
              createdAtLabel,
            }}
          />
        </Container>
      </header>

      <main className="px-6 py-16">
        <Container>
          <div className="rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
            <h1 className="font-display text-3xl uppercase tracking-[0.2em]">
              Cuenta
            </h1>
            <p className="mt-2 text-sm text-muted">
              Sesión activa para {user.email}
            </p>

            <div className="mt-6 grid gap-3 text-sm">
              <div>
                <span className="font-semibold">Rol:</span> Usuario
              </div>
              <div>
                <span className="font-semibold">ID:</span> {user.id}
              </div>
              <div>
                <span className="font-semibold">Creado:</span>{" "}
                {user.createdAt.toLocaleString("es-AR")}
              </div>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}

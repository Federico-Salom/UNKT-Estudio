import Link from "next/link";
import { redirect } from "next/navigation";
import Container from "@/components/Container";
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

  if (!isAdmin) {
    redirect("/account");
  }

  const studio = await getStudioContent();

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
          <a
            className="text-sm font-semibold uppercase tracking-wide text-fg/80 transition hover:text-fg"
            href="/api/auth/logout"
          >
            Salir
          </a>
        </Container>
      </header>

      <main className="px-6 py-16">
        <Container>
          <div className="rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
            <h1 className="font-display text-3xl uppercase tracking-[0.2em]">
              Panel
            </h1>
            <p className="mt-2 text-sm text-muted">
              Sesión activa para {user.email}
            </p>

            <div className="mt-6 grid gap-3 text-sm">
              <div>
                <span className="font-semibold">Rol:</span> {roleLabel}
              </div>
              <div>
                <span className="font-semibold">ID:</span> {user.id}
              </div>
              <div>
                <span className="font-semibold">Creado:</span>{" "}
                {user.createdAt.toLocaleString("es-AR")}
              </div>
            </div>

            {isAdmin && (
              <div className="mt-8 flex flex-wrap gap-3">
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
            )}
          </div>
        </Container>
      </main>
    </div>
  );
}

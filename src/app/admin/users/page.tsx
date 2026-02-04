import Link from "next/link";
import { redirect } from "next/navigation";
import AdminUsersPanel from "@/components/AdminUsersPanel";
import Container from "@/components/Container";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
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

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  const usersForPanel = users.map((item) => ({
    id: item.id,
    email: item.email,
    role: item.role as "admin" | "user",
    createdAtLabel: item.createdAt.toLocaleString("es-AR"),
  }));

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
          <div className="flex items-center gap-6">
            <Link
              className="text-sm font-semibold uppercase tracking-wide text-fg/80 transition hover:text-fg"
              href="/admin"
            >
              Panel
            </Link>
            <a
              className="text-sm font-semibold uppercase tracking-wide text-fg/80 transition hover:text-fg"
              href="/api/auth/logout"
            >
              Salir
            </a>
          </div>
        </Container>
      </header>

      <main className="px-6 py-16">
        <Container>
          <AdminUsersPanel users={usersForPanel} />
        </Container>
      </main>
    </div>
  );
}

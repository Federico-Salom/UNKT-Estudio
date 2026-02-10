import Link from "next/link";
import { redirect } from "next/navigation";
import AdminUsersPanel from "@/components/AdminUsersPanel";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
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
  const createdAtLabel = user.createdAt.toLocaleString("es-AR");

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
    <div className="admin-dashboard admin-users-page min-h-screen bg-bg text-fg">
      <header className="border-b border-accent/20 bg-bg/95">
        <Container className="flex items-center justify-between py-4">
          <BrandMark studio={studio} />
          <div className="flex items-center gap-6">
            <Link
              className="inline-flex items-center justify-center rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-center text-sm font-semibold leading-none tracking-wide text-accent transition hover:border-accent hover:bg-accent/20"
              href="/admin"
            >
              Panel
            </Link>
            <ThemeToggle />
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

      <main className="px-6 py-16">
        <Container>
          <AdminUsersPanel
            users={usersForPanel}
            currentUserId={session.userId}
          />
        </Container>
      </main>
    </div>
  );
}

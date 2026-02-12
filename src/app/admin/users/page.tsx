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
              Volver
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

      <main className="px-2 py-8 sm:px-6">
        <Container className="px-1.5 sm:px-6">
          <AdminUsersPanel
            users={usersForPanel}
            currentUserId={session.userId}
          />
        </Container>
      </main>
    </div>
  );
}

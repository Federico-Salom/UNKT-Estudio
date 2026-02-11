import Link from "next/link";
import { redirect } from "next/navigation";
import AdminContentForm from "@/components/AdminContentForm";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
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

  return (
    <div className="admin-content-editor min-h-screen bg-bg text-fg">
      <header className="relative z-50 border-b border-accent/20 bg-bg/95 backdrop-blur">
        <Container className="flex items-center justify-between gap-2.5 px-3 py-2.5 sm:px-6 md:py-4">
          <div className="min-w-0 flex items-center">
            <div className="md:hidden">
              <BrandMark
                studio={studio}
                size={36}
                wordmarkScale={0.9}
                gapClassName="gap-2 sm:gap-2.5"
                className="max-w-[58vw] sm:max-w-full"
              />
            </div>
            <div className="hidden md:block">
              <BrandMark studio={studio} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:gap-4">
            <Link
              className="hidden md:inline-flex h-10 items-center justify-center rounded-full border border-accent/35 bg-accent/10 px-6 text-center text-base font-semibold leading-none tracking-wide text-accent transition hover:border-accent hover:bg-accent/20"
              href="/admin"
            >
              Panel
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

      <main className="py-8 sm:py-12 md:py-16">
        <Container>
          <AdminContentForm studio={studio} gallery={studio.gallery} />
        </Container>
      </main>
    </div>
  );
}

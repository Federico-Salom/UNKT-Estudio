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
import { studio as fallbackStudio } from "@/content/studio";

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
  const gallery = studio.gallery.length ? studio.gallery : fallbackStudio.gallery;
  const createdAtLabel = user.createdAt.toLocaleString("es-AR");

  return (
    <div className="admin-content-editor min-h-screen bg-bg text-fg">
      <header className="border-b border-accent/20 bg-bg/95">
        <Container className="flex items-center justify-between py-4">
          <BrandMark studio={studio} />
          <div className="flex items-center gap-6">
            <Link
              className="inline-flex items-center rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/20"
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
          <AdminContentForm studio={studio} gallery={gallery} />
        </Container>
      </main>
    </div>
  );
}

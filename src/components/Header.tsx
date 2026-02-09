import Container from "@/components/Container";
import BrandMark from "@/components/BrandMark";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import type { StudioContent } from "@/content/studio";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type HeaderProps = {
  studio: StudioContent;
};

export default async function Header({ studio }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-accent/20 bg-bg/95 backdrop-blur">
      <Container className="flex items-center justify-between gap-3 py-3 md:py-4">
        <div className="md:hidden">
          <BrandMark studio={studio} size={40} showText={false} />
        </div>
        <div className="hidden md:block">
          <BrandMark studio={studio} />
        </div>
        <HeaderActions />
      </Container>
    </header>
  );
}

async function HeaderActions() {
  const session = await getSessionFromCookies();
  if (!session) {
    return (
      <div className="flex items-center gap-2 md:gap-4">
        <ThemeToggle />
        <a
          className="inline-flex text-xs font-semibold uppercase tracking-wide text-fg/80 transition hover:text-fg md:text-sm"
          href="/login"
        >
          Iniciar sesion
        </a>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user) {
    return (
      <div className="flex items-center gap-2 md:gap-4">
        <ThemeToggle />
        <a
          className="inline-flex text-xs font-semibold uppercase tracking-wide text-fg/80 transition hover:text-fg md:text-sm"
          href="/login"
        >
          Iniciar sesion
        </a>
      </div>
    );
  }

  const roleLabel = user.role === "admin" ? "Administrador" : "Usuario";

  return (
    <div className="flex items-center gap-2 md:gap-4">
      <ThemeToggle />
      <UserMenu
        user={{
          email: user.email,
          roleLabel,
        }}
      />
    </div>
  );
}

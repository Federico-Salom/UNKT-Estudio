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
    <header className="relative z-50 border-b border-accent/20 bg-bg/95 backdrop-blur">
      <Container className="flex items-center justify-between gap-2.5 px-3 py-2.5 sm:px-6 md:gap-3 md:py-4">
        <div className="min-w-0 flex flex-1 items-center md:hidden">
          <BrandMark
            studio={studio}
            size={36}
            wordmarkScale={0.9}
            wordmarkOffsetY={0.25}
            gapClassName="gap-2 sm:gap-2.5"
            className="max-w-[58vw] sm:max-w-full"
          />
        </div>
        <div className="hidden min-w-0 items-center md:flex">
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
      <div className="flex shrink-0 items-center gap-2 md:gap-4">
        <ThemeToggle className="h-9 w-9 md:h-10 md:w-10" />
        <a
          className="inline-flex h-9 items-center justify-center rounded-full border border-accent/35 bg-accent/10 px-4 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 md:h-10 md:text-sm"
          href="/login"
        >
          <span className="md:hidden">Entrar</span>
          <span className="hidden md:inline">Iniciar sesion</span>
        </a>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-2 md:gap-4">
        <ThemeToggle className="h-9 w-9 md:h-10 md:w-10" />
        <a
          className="inline-flex h-9 items-center justify-center rounded-full border border-accent/35 bg-accent/10 px-4 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 md:h-10 md:text-sm"
          href="/login"
        >
          <span className="md:hidden">Entrar</span>
          <span className="hidden md:inline">Iniciar sesion</span>
        </a>
      </div>
    );
  }

  const roleLabel = user.role === "admin" ? "Administrador" : "Usuario";

  return (
    <div className="flex shrink-0 items-center gap-2 md:gap-4">
      <ThemeToggle className="h-9 w-9 md:h-10 md:w-10" />
      <UserMenu
        user={{
          email: user.email,
          roleLabel,
        }}
      />
    </div>
  );
}

import { cookies } from "next/headers";
import Container from "@/components/Container";
import BrandMark from "@/components/BrandMark";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import type { StudioContent } from "@/content/studio";
import { AUTH_COOKIE, getSessionFromCookies } from "@/lib/auth";

type HeaderProps = {
  studio: StudioContent;
};

export default async function Header({ studio }: HeaderProps) {
  return (
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

        <div className="shrink-0">
          <HeaderActions />
        </div>
      </Container>
    </header>
  );
}

async function HeaderActions() {
  const session = await getSessionFromCookies();
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore.has(AUTH_COOKIE);
  const isAuthenticated = Boolean(session) || hasAuthCookie;
  const roleLabel = session?.role === "admin" ? "Administrador" : "Usuario";
  const email = session?.email || (isAuthenticated ? "Cuenta" : "Invitado");

  return (
    <div className="flex shrink-0 items-center gap-2 md:gap-4">
      <ThemeToggle className="h-9 w-9 md:h-10 md:w-10" />
      <UserMenu
        user={{
          email,
          roleLabel,
        }}
        authenticated={isAuthenticated}
      />
    </div>
  );
}

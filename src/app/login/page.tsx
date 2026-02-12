import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
import LoginForm from "@/components/LoginForm";
import ThemeToggle from "@/components/ThemeToggle";
import { getStudioContent } from "@/lib/studio-content";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
    registered?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const studio = await getStudioContent();
  const resolvedSearchParams = await searchParams;
  const error = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error;
  const registered = Array.isArray(resolvedSearchParams?.registered)
    ? resolvedSearchParams?.registered[0]
    : resolvedSearchParams?.registered;

  return (
    <div className="auth-page min-h-screen bg-bg text-fg">
      <header className="border-b border-accent/20 bg-bg/95">
        <Container className="flex items-center justify-between gap-2 px-3 py-3 sm:px-6 sm:py-4">
          <BrandMark studio={studio} showText={false} size={36} />
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full border border-accent/35 bg-accent/10 px-3 text-[11px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 sm:h-10 sm:px-4 sm:text-xs"
              href="/"
            >
              Volver
            </Link>
            <ThemeToggle />
          </div>
        </Container>
      </header>

      <main className="flex min-h-[calc(100vh-72px)] items-center justify-center px-3 py-8 sm:min-h-[calc(100vh-80px)] sm:px-6 sm:py-16">
        <div className="w-full max-w-md rounded-3xl border border-accent/20 bg-white/70 p-5 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur sm:p-8">
          <h1 className="font-display text-[2rem] uppercase tracking-[0.14em] sm:text-3xl sm:tracking-[0.2em] text-center">
            Iniciar sesión
          </h1>
          <LoginForm
            initialError={error}
            registered={registered === "true" || Boolean(registered)}
          />

          <div className="mt-6 grid gap-3 text-center text-sm text-muted sm:grid-cols-2 sm:gap-4">
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-accent/15 bg-bg/70 px-4 py-3">
              <span className="flex min-h-[3rem] items-center justify-center leading-tight">
                ¿No tienes cuenta?
              </span>
              <Link
                className="inline-flex items-center justify-center rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/20"
                href="/register"
              >
                Regístrate
              </Link>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-accent/15 bg-bg/70 px-4 py-3">
              <span className="flex min-h-[3rem] items-center justify-center leading-tight">
                ¿Olvidaste tu contraseña?
              </span>
              <Link
                className="inline-flex items-center justify-center rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/20"
                href="/recuperar-contrasena"
              >
                Recuperar
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

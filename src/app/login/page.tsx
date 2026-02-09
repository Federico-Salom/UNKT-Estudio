import Link from "next/link";
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
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-accent/20 bg-bg/95">
        <Container className="flex items-center justify-between py-4">
          <Link
            className="font-display text-2xl uppercase tracking-[0.2em] text-fg"
            href="/"
          >
            {studio.name}
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              className="text-sm font-semibold uppercase tracking-wide text-fg/80 transition hover:text-fg"
              href="/register"
            >
              Crear cuenta
            </Link>
          </div>
        </Container>
      </header>

      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
          <h1 className="font-display text-3xl uppercase tracking-[0.2em]">
            Iniciar sesión
          </h1>
          <p className="mt-2 text-sm text-muted">
            Accede al panel con tu correo y contraseña.
          </p>

          <LoginForm
            initialError={error}
            registered={registered === "true" || Boolean(registered)}
          />

          <div className="mt-6 text-sm text-muted">
            No tienes cuenta?{" "}
            <Link className="font-semibold text-fg" href="/register">
              Regístrate
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

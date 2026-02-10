import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
import RegisterForm from "@/components/RegisterForm";
import ThemeToggle from "@/components/ThemeToggle";
import { getStudioContent } from "@/lib/studio-content";

type RegisterPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const studio = await getStudioContent();
  const resolvedSearchParams = await searchParams;
  const error = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error;

  return (
    <div className="auth-page min-h-screen bg-bg text-fg">
      <header className="border-b border-accent/20 bg-bg/95">
        <Container className="flex items-center justify-between py-4">
          <BrandMark studio={studio} />
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              className="inline-flex h-10 items-center justify-center rounded-full border border-accent/35 bg-accent/10 px-4 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
              href="/login"
            >
              Iniciar sesion
            </Link>
          </div>
        </Container>
      </header>

      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
          <h1 className="font-display text-3xl uppercase tracking-[0.2em]">
            Crear cuenta
          </h1>
          <p className="mt-2 text-sm text-muted">
            El primer usuario creado queda como administrador.
          </p>

          <RegisterForm serverError={error} />

          <div className="mt-6 text-sm text-muted">
            Ya tienes cuenta?{" "}
            <Link
              className="inline-flex items-center rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/20"
              href="/login"
            >
              Inicia sesion
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

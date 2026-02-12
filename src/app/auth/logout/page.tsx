import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/Container";
import ThemeToggle from "@/components/ThemeToggle";
import LogoutPanel from "./LogoutPanel";
import { getStudioContent } from "@/lib/studio-content";

export default async function LogoutPage() {
  const studio = await getStudioContent();

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
        <div className="w-full max-w-3xl rounded-3xl border border-accent/20 bg-white/70 p-6 text-center shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur sm:p-8">
          <p className="text-sm text-muted">
            Procesamos tu salida con estilo. La animacion resume el viaje y te deja listo para volver.
          </p>
          <div className="mt-6">
            <LogoutPanel />
          </div>
        </div>
      </main>
    </div>
  );
}

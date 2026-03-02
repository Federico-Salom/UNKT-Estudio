"use client";

import Link from "next/link";
import { useEffect } from "react";
import BrandMark from "@/components/BrandMark";
import ThemeToggle from "@/components/ThemeToggle";
import { studio } from "@/content/studio";

type AdminErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminErrorPage({ error, reset }: AdminErrorPageProps) {
  useEffect(() => {
    console.error("[app/admin/error]", error);
  }, [error]);

  return (
    <div className="admin-dashboard min-h-screen bg-bg text-fg">
      <header className="relative z-50 border-b border-accent/20 bg-bg/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2.5 px-3 py-2.5 sm:px-6 md:py-4">
          <div className="min-w-0 flex items-center">
            <BrandMark studio={studio} showText={false} size={36} />
          </div>
          <div className="flex shrink-0 items-center gap-2 md:gap-4">
            <Link
              className="inline-flex h-9 items-center justify-center rounded-full border border-accent/35 bg-accent/10 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/20 md:h-10 md:px-5"
              href="/admin"
            >
              Volver
            </Link>
            <ThemeToggle className="h-9 w-9 md:h-10 md:w-10" />
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-6xl items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <section className="w-full max-w-2xl rounded-3xl border border-accent/20 bg-white/70 p-6 text-center shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur sm:p-8">
          <p className="text-[0.7rem] uppercase tracking-[0.3em] text-muted">
            Panel admin
          </p>
          <h1 className="mt-4 font-display text-2xl uppercase tracking-[0.12em] sm:text-3xl">
            No pudimos cargar esta seccion
          </h1>
          <p className="mt-4 text-sm text-fg/80 sm:text-base">
            Revisa la conexion y vuelve a intentar.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center rounded-full border border-transparent bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2"
            >
              Reintentar
            </button>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-full border border-accent/35 bg-accent/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/20"
            >
              Ir al panel
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

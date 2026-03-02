"use client";

import Link from "next/link";
import { useEffect } from "react";
import ThemeToggle from "@/components/ThemeToggle";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-accent/20 bg-bg/95">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-accent/35 bg-accent/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/20"
          >
            UNKT Estudio
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4 py-10 sm:min-h-[calc(100vh-80px)] sm:px-6 sm:py-16">
        <section className="w-full max-w-xl rounded-3xl border border-accent/20 bg-white/70 p-6 text-center shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur sm:p-8">
          <p className="text-[0.7rem] uppercase tracking-[0.3em] text-muted">
            Error inesperado
          </p>
          <h1 className="mt-4 font-display text-2xl uppercase tracking-[0.12em] sm:text-3xl">
            No pudimos cargar esta pantalla
          </h1>
          <p className="mt-4 text-sm text-fg/80 sm:text-base">
            Puede ser un problema temporal del servidor o de conexion.
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
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-accent/35 bg-accent/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/20"
            >
              Volver al inicio
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

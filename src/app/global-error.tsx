"use client";

import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[app/global-error]", error);
  }, [error]);

  return (
    <html lang="es">
      <body className="min-h-screen bg-bg text-fg">
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
          <section className="w-full max-w-xl rounded-3xl border border-accent/25 bg-white/80 p-6 text-center shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur sm:p-8">
            <p className="text-[0.7rem] uppercase tracking-[0.3em] text-muted">
              Error critico
            </p>
            <h1 className="mt-4 font-display text-2xl uppercase tracking-[0.12em] sm:text-3xl">
              El sitio encontro un problema
            </h1>
            <p className="mt-4 text-sm text-fg/80 sm:text-base">
              Intenta recargar en unos segundos.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-7 inline-flex items-center justify-center rounded-full border border-transparent bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2"
            >
              Reintentar
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}

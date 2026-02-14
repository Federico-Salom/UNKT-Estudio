import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

export default async function NotFoundPage() {
  const studio = await getStudioContent();

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <Header studio={studio} />

      <main className="flex flex-1 items-center px-4 py-10 sm:px-6 sm:py-16">
        <section className="mx-auto w-full max-w-3xl rounded-[2.5rem] border border-accent/30 bg-bg/80 p-6 text-center shadow-[0_25px_45px_-35px_rgba(0,0,0,0.9)] backdrop-blur sm:p-10">
          <p className="text-[0.7rem] uppercase tracking-[0.4em] text-muted">
            Error 404 - Página no encontrada
          </p>

          <h1 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            No pudimos encontrar la ruta solicitada.
          </h1>

          <p className="mt-5 text-sm text-fg/80 sm:text-base">
            La URL que abriste no coincide con una página válida del sitio. Esto
            puede pasar por un enlace viejo, una dirección escrita con error o una
            página que fue movida.
          </p>

          <p className="mt-4 text-sm text-fg/80 sm:text-base">
            Verifica la dirección en la barra del navegador y, si necesitas seguir
            navegando, vuelve al inicio desde el botón de abajo.
          </p>

          <div className="mt-8 flex justify-center">
            <Link
              href="/"
              className="inline-flex w-full max-w-xs items-center justify-center rounded-full border border-transparent bg-accent px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-bg transition hover:bg-accent2"
            >
              Volver al inicio
            </Link>
          </div>
        </section>
      </main>

      <Footer studio={studio} />
    </div>
  );
}

import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";

type HeaderProps = {
  studio: StudioContent;
};

export default function Header({ studio }: HeaderProps) {
  const bookingLink = "/reservar";
  const primaryCta =
    studio.ctas.primary.replace(/\s*por\s*whats?app/i, "").trim() || "Reservar";

  return (
    <header className="sticky top-0 z-50 border-b border-accent/20 bg-bg/95 backdrop-blur">
      <Container className="flex items-center justify-between py-4">
        <div className="font-display text-2xl uppercase tracking-[0.2em] text-fg">
          {studio.name}
        </div>
        <div className="flex items-center gap-4">
          <a
            className="inline-flex text-sm font-semibold uppercase tracking-wide text-fg/80 transition hover:text-fg"
            href="/login"
          >
            Iniciar sesión
          </a>
          <a
            className="hidden items-center justify-center rounded-full bg-accent px-5 py-2 text-sm font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 md:inline-flex"
            href={bookingLink}
          >
            {primaryCta}
          </a>
        </div>
      </Container>
    </header>
  );
}

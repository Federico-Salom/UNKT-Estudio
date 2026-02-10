import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";

type HeroProps = {
  studio: StudioContent;
};

export default function Hero({ studio }: HeroProps) {
  const bookingLink = "/reservar";
  const primaryCta =
    studio.ctas.primary.replace(/\s*por\s*whats?app/i, "").trim() || "Reservar";

  return (
    <section className="relative overflow-hidden bg-bg py-12 md:py-16">
      <Container>
        <div className="w-full max-w-6xl space-y-6">
          <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-fg sm:text-5xl md:text-6xl">
            {studio.hero.title}
          </h1>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
            <p className="max-w-3xl text-lg text-muted">{studio.hero.subtitle}</p>
            <a
              className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bg shadow-[0_12px_24px_-12px_rgba(0,0,0,0.6)] transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
              href={bookingLink}
            >
              <span className="button-label">{primaryCta}</span>
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}

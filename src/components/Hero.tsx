import Image from "next/image";
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
    <section className="relative overflow-hidden bg-bg py-16 md:py-24">
      <Container className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
            {studio.name}
          </p>
          <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-fg sm:text-5xl md:text-6xl">
            {studio.hero.title}
          </h1>
          <p className="max-w-md text-lg text-muted">{studio.hero.subtitle}</p>
          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bg shadow-[0_12px_24px_-12px_rgba(0,0,0,0.6)] transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
              href={bookingLink}
            >
              {primaryCta}
            </a>
          </div>
        </div>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-accent/20 bg-muted/10 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.6)]">
          <Image
            src={studio.hero.image.src}
            alt={studio.hero.image.alt}
            fill
            className="object-cover"
            sizes="(min-width: 768px) 45vw, 90vw"
            priority
          />
        </div>
      </Container>
    </section>
  );
}

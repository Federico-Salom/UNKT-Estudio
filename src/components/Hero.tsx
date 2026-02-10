import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";

type HeroProps = {
  studio: StudioContent;
};

export default function Hero({ studio }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-bg pt-10 pb-3 md:pt-14 md:pb-8">
      <Container>
        <div className="w-full max-w-6xl space-y-4 md:space-y-5">
          <h1 className="font-display text-4xl uppercase tracking-[0.08em] leading-[1.08] text-fg sm:text-5xl md:text-6xl">
            {studio.hero.title}
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-muted">
            {studio.hero.subtitle}
          </p>
        </div>
      </Container>
    </section>
  );
}

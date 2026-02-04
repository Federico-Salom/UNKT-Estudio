import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";

type HowToBookProps = {
  studio: StudioContent;
};

export default function HowToBook({ studio }: HowToBookProps) {
  return (
    <section className="bg-bg py-14 md:py-20">
      <Container>
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
            {studio.howToBook.title}
          </p>
          <h2 className="font-display text-3xl uppercase tracking-[0.08em] text-fg">
            {studio.howToBook.title}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {studio.howToBook.steps.map((step, index) => (
            <div
              key={step}
              className="rounded-2xl border border-accent/20 bg-bg px-6 py-6"
            >
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
                Paso {index + 1}
              </div>
              <p className="text-base text-fg">{step}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";

type IncludedProps = {
  studio: StudioContent;
};

export default function Included({ studio }: IncludedProps) {
  return (
    <section className="bg-bg py-14 md:py-20">
      <Container>
        <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
              {studio.included.title}
            </p>
            <h2 className="font-display text-3xl uppercase tracking-[0.08em] text-fg">
              {studio.included.title}
            </h2>
            <p className="mt-3 text-lg text-muted">
              {studio.included.subtitle}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {studio.included.items.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-accent/20 bg-bg px-5 py-6 text-center text-sm font-semibold uppercase tracking-wide text-fg shadow-[0_18px_36px_-28px_rgba(0,0,0,0.4)]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";

type ExtrasProps = {
  studio: StudioContent;
};

export default function Extras({ studio }: ExtrasProps) {
  return (
    <section className="relative bg-bg py-14 md:py-20">
      <span className="absolute right-4 top-4 rounded-full border border-accent/30 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.4em] text-accent shadow-[0_10px_24px_-14px_rgba(0,0,0,0.8)]">
        Extras
      </span>
      <Container>
        <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
              {studio.extras.title}
            </p>
            <h2 className="font-display text-3xl uppercase tracking-[0.08em] text-fg">
              {studio.extras.title}
            </h2>
            <p className="mt-3 text-lg text-muted">{studio.extras.subtitle}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {studio.extras.items.map((item) => (
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

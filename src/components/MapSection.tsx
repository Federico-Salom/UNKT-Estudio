import Image from "next/image";
import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";

type MapSectionProps = {
  studio: StudioContent;
};

export default function MapSection({ studio }: MapSectionProps) {
  const floorPlanLink = "#galeria";
  const floorPlanSrc = "/plano-estudio.svg";
  const floorPlanAlt = studio.hero.image.alt || "Plano del lugar";

  return (
    <section className="bg-bg py-14 md:py-20">
      <Container>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl uppercase tracking-[0.08em] text-fg">
              Plano del lugar
            </h2>
            <p className="mt-2 text-sm text-muted">
              Toca el plano para ir a la galeria.
            </p>
          </div>
          <a
            href={floorPlanLink}
            className="inline-flex items-center justify-center rounded-full border border-accent/30 bg-bg px-5 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
          >
            Ver galeria
          </a>
        </div>

        <a
          href={floorPlanLink}
          className="group relative block overflow-hidden rounded-3xl border border-accent/15 bg-white/70 p-3 shadow-[0_28px_60px_-40px_rgba(0,0,0,0.6)] backdrop-blur transition hover:border-accent/35"
          aria-label="Ver plano del lugar e ir a la galeria"
        >
          <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-bg/80">
            <div className="relative aspect-[16/10] md:aspect-[16/9]">
              <Image
                src={floorPlanSrc}
                alt={floorPlanAlt}
                fill
                className="object-contain object-center transition duration-500 group-hover:scale-[1.008]"
                sizes="(max-width: 768px) 96vw, 1200px"
              />
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-accent/20 bg-bg/90 px-4 py-3 backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
              Plano del lugar
            </p>
            <p className="mt-1 text-sm font-semibold text-fg">
              Toca para ver la galeria
            </p>
          </div>
        </a>
      </Container>
    </section>
  );
}

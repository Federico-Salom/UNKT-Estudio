import Image from "next/image";
import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";

type GalleryProps = {
  studio: StudioContent;
};

export default function Gallery({ studio }: GalleryProps) {
  return (
    <section className="bg-bg py-14 md:py-20">
      <Container>
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
              Galería
            </p>
            <h2 className="font-display text-3xl uppercase tracking-[0.08em] text-fg">
              Así se ve el espacio
            </h2>
          </div>
          <span className="hidden text-sm text-muted md:inline">
            {studio.gallery.length} imágenes
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {studio.gallery.map((image) => (
            <div
              key={image.src}
              className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-accent/15 bg-muted/10"
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-cover"
                sizes="(min-width: 768px) 30vw, 48vw"
              />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

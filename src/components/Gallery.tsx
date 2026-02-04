"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";

type GalleryProps = {
  studio: StudioContent;
};

export default function Gallery({ studio }: GalleryProps) {
  const gallery = studio.gallery ?? [];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activePanel, setActivePanel] = useState<"included" | "extras" | null>(
    null
  );
  const [previewItem, setPreviewItem] = useState<{
    label: string;
    type: "included" | "extras";
  } | null>(null);

  useEffect(() => {
    slideRefs.current = slideRefs.current.slice(0, gallery.length);
  }, [gallery.length]);

  const scrollToIndex = (index: number) => {
    const slide = slideRefs.current[index];
    if (!slide) return;
    slide.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setCurrentIndex(index);
  };

  const handlePrev = () => {
    if (!gallery.length) return;
    const next = (currentIndex - 1 + gallery.length) % gallery.length;
    scrollToIndex(next);
  };

  const handleNext = () => {
    if (!gallery.length) return;
    const next = (currentIndex + 1) % gallery.length;
    scrollToIndex(next);
  };

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const center = container.scrollLeft + container.clientWidth / 2;
    let nearest = 0;
    let minDistance = Number.POSITIVE_INFINITY;
    slideRefs.current.forEach((slide, index) => {
      if (!slide) return;
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const distance = Math.abs(center - slideCenter);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = index;
      }
    });
    setCurrentIndex(nearest);
  };

  if (!gallery.length) {
    return null;
  }

  const togglePanel = (panel: "included" | "extras") => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const openPreview = (label: string, type: "included" | "extras") => {
    setPreviewItem({ label, type });
    setActivePanel(null);
  };

  const closePreview = () => setPreviewItem(null);

  return (
    <section className="bg-bg py-14 md:py-20">
      <Container>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
              Galeria
            </p>
            <h2 className="font-display text-3xl uppercase tracking-[0.08em] text-fg">
              Asi se ve el espacio
            </h2>
          </div>
          <span className="hidden text-sm text-muted md:inline">
            {gallery.length} imagenes
          </span>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute left-2 top-0 z-20 flex flex-col items-start gap-2 sm:left-4">
            <button
              type="button"
              onClick={() => togglePanel("included")}
              className="pointer-events-auto rounded-full border border-accent/30 bg-bg/90 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-accent shadow-[0_12px_26px_-18px_rgba(0,0,0,0.45)] transition hover:border-accent hover:bg-bg"
            >
              Incluidos
            </button>
            {activePanel === "included" ? (
              <div className="pointer-events-auto w-64 rounded-2xl border border-accent/20 bg-bg/95 p-4 text-left text-sm text-fg shadow-[0_20px_40px_-28px_rgba(0,0,0,0.5)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  {studio.included.title}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {studio.included.items.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => openPreview(item, "included")}
                      className="rounded-full border border-accent/25 bg-bg px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-fg transition hover:border-accent"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="pointer-events-none absolute right-2 top-0 z-20 flex flex-col items-end gap-2 sm:right-4">
            <button
              type="button"
              onClick={() => togglePanel("extras")}
              className="pointer-events-auto rounded-full border border-accent/30 bg-bg/90 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-accent shadow-[0_12px_26px_-18px_rgba(0,0,0,0.45)] transition hover:border-accent hover:bg-bg"
            >
              Extras
            </button>
            {activePanel === "extras" ? (
              <div className="pointer-events-auto w-64 rounded-2xl border border-accent/20 bg-bg/95 p-4 text-left text-sm text-fg shadow-[0_20px_40px_-28px_rgba(0,0,0,0.5)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  {studio.extras.title}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {studio.extras.items.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => openPreview(item, "extras")}
                      className="rounded-full border border-accent/25 bg-bg px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-fg transition hover:border-accent"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Imagen anterior"
            onClick={handlePrev}
            className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-accent/30 bg-bg/90 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-accent shadow-[0_10px_30px_-20px_rgba(0,0,0,0.4)] transition hover:border-accent hover:bg-bg md:inline-flex"
          >
            ?
          </button>

          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-2 pb-4 pt-16 md:px-6"
          >
            {gallery.map((image, index) => (
              <div
                key={`${image.src}-${index}`}
                ref={(el) => {
                  slideRefs.current[index] = el;
                }}
                className="relative flex-[0_0_82%] snap-center overflow-hidden rounded-3xl border border-accent/15 bg-muted/10 shadow-[0_24px_50px_-36px_rgba(0,0,0,0.6)] md:flex-[0_0_65%] lg:flex-[0_0_55%]"
              >
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 50vw, (min-width: 768px) 65vw, 85vw"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            aria-label="Imagen siguiente"
            onClick={handleNext}
            className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-accent/30 bg-bg/90 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-accent shadow-[0_10px_30px_-20px_rgba(0,0,0,0.4)] transition hover:border-accent hover:bg-bg md:inline-flex"
          >
            ?
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          {gallery.map((_, index) => (
            <button
              key={`dot-${index}`}
              type="button"
              aria-label={`Ir a la imagen ${index + 1}`}
              onClick={() => scrollToIndex(index)}
              className={`h-2 w-2 rounded-full transition ${
                index === currentIndex
                  ? "bg-accent"
                  : "bg-accent/30 hover:bg-accent/60"
              }`}
            />
          ))}
        </div>
      </Container>

      {previewItem ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={closePreview}
            className="absolute inset-0 h-full w-full cursor-default"
          />
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-accent/20 bg-bg p-6 text-left shadow-[0_30px_60px_-40px_rgba(0,0,0,0.6)]">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
              {previewItem.type === "included" ? "Incluido" : "Extra"}
            </p>
            <h3 className="mt-3 font-display text-2xl uppercase tracking-[0.08em] text-fg">
              {previewItem.label}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {previewItem.type === "included"
                ? studio.included.subtitle
                : studio.extras.subtitle}
            </p>
            <div className="mt-5 flex items-center justify-end">
              <button
                type="button"
                onClick={closePreview}
                className="rounded-full border border-accent/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

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
  const floorPlanSrc = studio.floorPlan.src || "/plano-estudio.svg";
  const floorPlanAlt = studio.floorPlan.alt || "Plano del lugar";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hintInitializedRef = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [planZoom, setPlanZoom] = useState(1);
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

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || hintInitializedRef.current) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hintInitializedRef.current = true;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);
        if (!isVisible || hintInitializedRef.current) return;
        hintInitializedRef.current = true;
        setShowSwipeHint(true);
        observer.disconnect();
      },
      { threshold: 0.45 }
    );

    observer.observe(stage);
    return () => observer.disconnect();
  }, [gallery.length]);

  useEffect(() => {
    if (!showSwipeHint) return;
    const timeoutId = window.setTimeout(() => {
      setShowSwipeHint(false);
    }, 30000);
    return () => window.clearTimeout(timeoutId);
  }, [showSwipeHint]);

  const dismissSwipeHint = () => {
    setShowSwipeHint((prev) => (prev ? false : prev));
  };

  const scrollToIndex = (index: number) => {
    const slide = slideRefs.current[index];
    if (!slide) return;
    slide.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setCurrentIndex(index);
  };

  const handlePrev = () => {
    if (!gallery.length) return;
    dismissSwipeHint();
    const next = (currentIndex - 1 + gallery.length) % gallery.length;
    scrollToIndex(next);
  };

  const handleNext = () => {
    if (!gallery.length) return;
    dismissSwipeHint();
    const next = (currentIndex + 1) % gallery.length;
    scrollToIndex(next);
  };

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    dismissSwipeHint();
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

  const openPlanModal = () => {
    setPreviewItem(null);
    setActivePanel(null);
    setPlanZoom(1);
    setIsPlanOpen(true);
  };

  const closePlanModal = () => {
    setIsPlanOpen(false);
  };

  const updatePlanZoom = (nextZoom: number) => {
    setPlanZoom(Math.min(3, Math.max(1, nextZoom)));
  };

  const closePreview = () => setPreviewItem(null);

  return (
    <section
      id="galeria"
      className="scroll-mt-24 bg-bg pt-6 pb-14 md:pt-10 md:pb-20"
    >
      <Container>
        <div className="mb-8 flex flex-col items-center gap-4 md:gap-5">
          <div className="grid w-full grid-cols-3 items-stretch gap-2 sm:gap-4 md:gap-6">
            <div className="relative w-full">
            <button
              type="button"
              onClick={() => togglePanel("extras")}
              className="w-full rounded-full border border-accent/30 bg-bg/90 px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent shadow-[0_12px_26px_-18px_rgba(0,0,0,0.45)] transition hover:border-accent hover:bg-bg sm:px-3"
            >
              <span className="button-label">Extras</span>
            </button>
            {activePanel === "extras" ? (
              <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-2xl border border-accent/20 bg-bg/95 p-4 text-left text-sm text-fg shadow-[0_20px_40px_-28px_rgba(0,0,0,0.5)]">
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
                      <span className="button-label">{item}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            </div>

            <div className="w-full">
              <button
                type="button"
                onClick={openPlanModal}
                className="w-full rounded-full border border-accent/30 bg-bg/90 px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent shadow-[0_12px_26px_-18px_rgba(0,0,0,0.45)] transition hover:border-accent hover:bg-bg sm:px-3"
              >
                <span className="button-label">Plano</span>
              </button>
            </div>

            <div className="relative w-full">
            <button
              type="button"
              onClick={() => togglePanel("included")}
              className="w-full rounded-full border border-accent/30 bg-bg/90 px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent shadow-[0_12px_26px_-18px_rgba(0,0,0,0.45)] transition hover:border-accent hover:bg-bg sm:px-3"
            >
              <span className="button-label">Incluidos</span>
            </button>
            {activePanel === "included" ? (
              <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-accent/20 bg-bg/95 p-4 text-left text-sm text-fg shadow-[0_20px_40px_-28px_rgba(0,0,0,0.5)]">
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
                      <span className="button-label">{item}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            </div>
          </div>
        </div>

        <div
          ref={stageRef}
          className="gallery-stage relative overflow-visible"
        >

          <button
            type="button"
            aria-label="Imagen anterior"
            onClick={handlePrev}
            className="gallery-nav-btn absolute left-1 top-1/2 z-10 -translate-y-1/2 items-center justify-center rounded-full border border-accent/30 bg-bg/90 p-3 text-accent shadow-[0_10px_30px_-20px_rgba(0,0,0,0.4)] transition hover:border-accent hover:bg-bg md:left-3 md:inline-flex"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div
            ref={containerRef}
            onScroll={handleScroll}
            onPointerDown={dismissSwipeHint}
            onTouchStart={dismissSwipeHint}
            onWheel={dismissSwipeHint}
            className="gallery-scroll -mb-2 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-8 pt-2 md:gap-6 md:px-8"
          >
            {gallery.map((image, index) => (
              <div
                key={`${image.src}-${index}`}
                ref={(el) => {
                  slideRefs.current[index] = el;
                }}
                className="gallery-slide relative snap-center overflow-hidden rounded-3xl border border-accent/15 bg-muted/10 shadow-[0_26px_56px_-32px_rgba(0,0,0,0.6)]"
              >
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    className="gallery-image object-cover"
                    sizes="(min-width: 1280px) 78vw, (min-width: 768px) 86vw, 92vw"
                  />
                </div>
              </div>
            ))}
          </div>

          {showSwipeHint ? (
            <div className="gallery-swipe-hint pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2">
              <div className="gallery-swipe-hint-pill">
                <span className="gallery-swipe-hint-text">Desliza</span>
                <span className="gallery-swipe-hint-arrows" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 6l-6 6 6 6" />
                  </svg>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 6l6 6-6 6" />
                  </svg>
                </span>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            aria-label="Imagen siguiente"
            onClick={handleNext}
            className="gallery-nav-btn absolute right-1 top-1/2 z-10 -translate-y-1/2 items-center justify-center rounded-full border border-accent/30 bg-bg/90 p-3 text-accent shadow-[0_10px_30px_-20px_rgba(0,0,0,0.4)] transition hover:border-accent hover:bg-bg md:right-3 md:inline-flex"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="mt-1 flex items-center justify-center gap-1.5">
          {gallery.map((_, index) => (
            <button
              key={`dot-${index}`}
              type="button"
              aria-label={`Ir a la imagen ${index + 1}`}
              onClick={() => {
                dismissSwipeHint();
                scrollToIndex(index);
              }}
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
                <span className="button-label">Cerrar</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isPlanOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 px-4 py-4">
          <button
            type="button"
            aria-label="Cerrar plano"
            onClick={closePlanModal}
            className="absolute inset-0 h-full w-full cursor-default"
          />
          <div className="relative z-10 w-full max-w-5xl rounded-3xl border border-accent/20 bg-bg p-4 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.75)] md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
                Plano
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updatePlanZoom(planZoom - 0.25)}
                  disabled={planZoom <= 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-accent/30 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-45"
                  aria-label="Alejar plano"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => updatePlanZoom(1)}
                  className="inline-flex h-9 min-w-[3.5rem] items-center justify-center rounded-full border border-accent/30 px-3 text-[11px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
                >
                  {Math.round(planZoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => updatePlanZoom(planZoom + 0.25)}
                  disabled={planZoom >= 3}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-accent/30 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-45"
                  aria-label="Acercar plano"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={closePlanModal}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-accent/30 px-4 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
                >
                  <span className="button-label">Cerrar</span>
                </button>
              </div>
            </div>

            <div className="mt-4 h-[72dvh] overflow-auto rounded-2xl border border-accent/20 bg-bg/80">
              <div
                className="min-w-full p-2"
                style={{ width: `${planZoom * 100}%` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={floorPlanSrc}
                  alt={floorPlanAlt}
                  className="h-auto w-full max-w-none select-none rounded-xl"
                  draggable={false}
                />
              </div>
            </div>

            <p className="mt-3 text-xs text-muted">
              Usa los botones de zoom y desliza para recorrer el plano.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

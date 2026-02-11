"use client";

import { useEffect, useRef, useState } from "react";

type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
};

type AdminMetricsCarouselProps = {
  metrics: DashboardMetric[];
};

const metricCardClassName =
  "rounded-2xl border border-accent/20 bg-white/70 p-5 shadow-[0_24px_50px_-40px_rgba(30,15,20,0.5)] backdrop-blur";
const metricMobileCardClassName = `${metricCardClassName} flex min-h-[11.5rem] flex-col items-center justify-center text-center`;

export default function AdminMetricsCarousel({
  metrics,
}: AdminMetricsCarouselProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    slideRefs.current = slideRefs.current.slice(0, metrics.length);
  }, [metrics.length]);

  const scrollToIndex = (index: number) => {
    const slide = slideRefs.current[index];
    if (!slide) return;
    slide.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
    setCurrentIndex(index);
  };

  const handlePrev = () => {
    if (!metrics.length) return;
    const next = (currentIndex - 1 + metrics.length) % metrics.length;
    scrollToIndex(next);
  };

  const handleNext = () => {
    if (!metrics.length) return;
    const next = (currentIndex + 1) % metrics.length;
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

  if (!metrics.length) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="md:hidden">
        <div className="gallery-frame mx-auto w-full max-w-3xl">
          <div className="gallery-stage relative overflow-visible">
            <button
              type="button"
              aria-label="Metrica anterior"
              onClick={handlePrev}
              className="gallery-nav-btn absolute -left-3 top-1/2 z-10 -translate-y-1/2 items-center justify-center rounded-full border border-accent/30 bg-bg/90 p-3 text-accent shadow-[0_10px_30px_-20px_rgba(0,0,0,0.4)] transition hover:border-accent hover:bg-bg md:left-3 md:inline-flex"
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
              className="gallery-scroll -mb-[44px] flex snap-x snap-mandatory gap-0 overflow-x-auto px-0 pb-[56px] pt-2"
            >
              {metrics.map((metric, index) => (
                <div
                  key={`${metric.label}-${index}`}
                  ref={(el) => {
                    slideRefs.current[index] = el;
                  }}
                  className="gallery-slide snap-center px-4"
                >
                  <article className={metricMobileCardClassName}>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                      {metric.label}
                    </p>
                    <p className="mt-3 font-display text-3xl uppercase tracking-[0.08em] text-fg">
                      {metric.value}
                    </p>
                    <p className="mt-1 text-xs text-muted">{metric.detail}</p>
                  </article>
                </div>
              ))}
            </div>

            <button
              type="button"
              aria-label="Metrica siguiente"
              onClick={handleNext}
              className="gallery-nav-btn absolute -right-3 top-1/2 z-10 -translate-y-1/2 items-center justify-center rounded-full border border-accent/30 bg-bg/90 p-3 text-accent shadow-[0_10px_30px_-20px_rgba(0,0,0,0.4)] transition hover:border-accent hover:bg-bg md:right-3 md:inline-flex"
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

          <div className="gallery-dots mt-0.5 flex h-4 items-center justify-center gap-1.5">
            {metrics.map((metric, index) => (
              <button
                key={`metric-dot-${metric.label}-${index}`}
                type="button"
                aria-label={`Ir a la metrica ${index + 1}`}
                onClick={() => {
                  scrollToIndex(index);
                }}
                className={`inline-flex h-2 w-2 items-center justify-center rounded-full transition ${
                  index === currentIndex
                    ? "bg-accent"
                    : "bg-accent/30 hover:bg-accent/60"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric, index) => (
          <article key={`${metric.label}-desktop-${index}`} className={metricCardClassName}>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
              {metric.label}
            </p>
            <p className="mt-3 font-display text-3xl uppercase tracking-[0.08em] text-fg">
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-muted">{metric.detail}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

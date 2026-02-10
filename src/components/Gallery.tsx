"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";

type GalleryProps = {
  studio: StudioContent;
};

const stripAccents = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const buildMapEmbedUrl = (locationUrl: string, fallbackQuery: string) => {
  if (!locationUrl) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(
      fallbackQuery
    )}&output=embed`;
  }

  if (locationUrl.includes("output=embed")) {
    return locationUrl;
  }

  if (
    locationUrl.includes("google.com/maps") ||
    locationUrl.includes("maps.google.com") ||
    locationUrl.includes("maps.app.goo.gl")
  ) {
    const joiner = locationUrl.includes("?") ? "&" : "?";
    return `${locationUrl}${joiner}output=embed`;
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(
    locationUrl
  )}&output=embed`;
};

const buildMapOpenUrl = (locationUrl: string, fallbackQuery: string) => {
  if (!locationUrl) {
    return `https://maps.google.com/?q=${encodeURIComponent(fallbackQuery)}`;
  }

  try {
    const parsedUrl = new URL(locationUrl);
    if (parsedUrl.searchParams.get("output") === "embed") {
      parsedUrl.searchParams.delete("output");
    }
    return parsedUrl.toString();
  } catch {
    try {
      const parsedUrl = new URL(`https://${locationUrl}`);
      if (parsedUrl.searchParams.get("output") === "embed") {
        parsedUrl.searchParams.delete("output");
      }
      return parsedUrl.toString();
    } catch {
      return `https://maps.google.com/?q=${encodeURIComponent(locationUrl)}`;
    }
  }
};

export default function Gallery({ studio }: GalleryProps) {
  const gallery = studio.gallery ?? [];
  const bookingLink = "/reservar";
  const primaryCta =
    studio.ctas.primary.replace(/\s*por\s*whats?app/i, "").trim() || "Reservar";
  const floorPlanSrc = studio.floorPlan.src || "/plano-estudio.svg";
  const floorPlanAlt = studio.floorPlan.alt || "Plano del lugar";
  const locationUrl = studio.contact.locationUrl || "";
  const locationText = (studio.contact.locationText || "").trim();
  const normalizedLocation = stripAccents(locationText.toLowerCase());
  const isPlaceholderText = normalizedLocation.includes("(sumar direccion");
  const hasLocationText =
    Boolean(locationText) &&
    !isPlaceholderText &&
    locationText.toLowerCase() !== studio.name.trim().toLowerCase();
  const locationQuery = hasLocationText ? locationText : studio.name;
  const mapEmbedUrl = buildMapEmbedUrl(locationUrl, locationQuery);
  const mapOpenUrl = buildMapOpenUrl(locationUrl, locationQuery);
  const mapAddressLabel = hasLocationText ? locationText : "";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [planZoom, setPlanZoom] = useState(1);
  const [activeCatalogModal, setActiveCatalogModal] = useState<
    "included" | "extras" | null
  >(null);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<{
    index: number;
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

  const openCatalogModal = (type: "included" | "extras") => {
    setActiveCatalogModal(type);
    setSelectedCatalogItem((currentItem) =>
      currentItem?.type === type ? currentItem : null
    );
    setIsPlanOpen(false);
    setIsLocationOpen(false);
  };

  const closeCatalogModal = () => {
    setActiveCatalogModal(null);
  };

  const selectCatalogItem = (
    index: number,
    label: string,
    type: "included" | "extras"
  ) => {
    setSelectedCatalogItem({ index, label, type });
  };

  const openPlanModal = () => {
    setActiveCatalogModal(null);
    setIsLocationOpen(false);
    setPlanZoom(1);
    setIsPlanOpen(true);
  };

  const closePlanModal = () => {
    setIsPlanOpen(false);
  };

  const openLocationModal = () => {
    setActiveCatalogModal(null);
    setIsPlanOpen(false);
    setIsLocationOpen(true);
  };

  const closeLocationModal = () => {
    setIsLocationOpen(false);
  };

  const updatePlanZoom = (nextZoom: number) => {
    setPlanZoom(Math.min(3, Math.max(1, nextZoom)));
  };

  const activeCatalogItems =
    activeCatalogModal === "included"
      ? studio.included.items
      : activeCatalogModal === "extras"
        ? studio.extras.items
        : [];
  const activeCatalogImages =
    activeCatalogModal === "included"
      ? studio.included.images
      : activeCatalogModal === "extras"
        ? studio.extras.images
        : [];
  const isSelectedCatalogItem = selectedCatalogItem?.type === activeCatalogModal;
  const selectedCatalogImage = isSelectedCatalogItem
    ? activeCatalogImages[selectedCatalogItem.index]
    : null;
  const selectedCatalogImageSrc = selectedCatalogImage?.src?.trim() || "";
  const selectedCatalogImageAlt =
    (selectedCatalogImage?.alt || "").trim() ||
    (isSelectedCatalogItem ? `Imagen de ${selectedCatalogItem.label}` : "");

  const topActionButtonClass =
    "inline-flex h-9 w-full items-center justify-center rounded-full border border-accent/30 bg-bg/90 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent shadow-[0_12px_26px_-18px_rgba(0,0,0,0.45)] transition hover:border-accent hover:bg-bg sm:px-3 md:h-11 md:px-5 md:text-[13px] md:tracking-[0.12em]";
  const bookingActionButtonClass =
    "inline-flex h-9 w-full items-center justify-center rounded-full border border-accent bg-accent px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-bg shadow-[0_16px_34px_-18px_rgba(0,0,0,0.55)] transition hover:border-accent2 hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 sm:px-3 md:h-11 md:px-5 md:text-[13px] md:tracking-[0.12em]";

  return (
    <section
      id="galeria"
      className="scroll-mt-24 bg-bg pt-1 pb-2 md:pt-6 md:pb-6"
    >
      <Container>
        <div className="mb-5 flex flex-col items-center gap-4 md:mb-6 md:gap-5">
          <div className="grid w-full max-w-5xl grid-cols-2 items-stretch gap-2 sm:grid-cols-5 sm:gap-4 md:gap-5">
            <div className="w-full">
              <button
                type="button"
                onClick={() => openCatalogModal("extras")}
                className={topActionButtonClass}
              >
                <span className="button-label">Extras</span>
              </button>
            </div>

            <div className="w-full">
              <button
                type="button"
                onClick={openPlanModal}
                className={topActionButtonClass}
              >
                <span className="button-label">Plano</span>
              </button>
            </div>

            <div className="w-full">
              <button
                type="button"
                onClick={openLocationModal}
                className={topActionButtonClass}
              >
                <span className="button-label">Ubicacion</span>
              </button>
            </div>

            <div className="w-full">
              <button
                type="button"
                onClick={() => openCatalogModal("included")}
                className={topActionButtonClass}
              >
                <span className="button-label">Incluidos</span>
              </button>
            </div>

            <div className="w-full">
              <a href={bookingLink} className={bookingActionButtonClass}>
                <span className="button-label">{primaryCta}</span>
              </a>
            </div>
          </div>
        </div>

        <div className="gallery-frame mx-auto w-full max-w-3xl">
          <div className="gallery-stage relative overflow-visible">
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
              className="gallery-scroll -mb-[44px] flex snap-x snap-mandatory gap-0 overflow-x-auto px-0 pb-[56px] pt-2"
            >
              {gallery.map((image, index) => (
                <div
                  key={`${image.src}-${index}`}
                  ref={(el) => {
                    slideRefs.current[index] = el;
                  }}
                  className="gallery-slide snap-center px-4 md:px-7"
                >
                  <div className="gallery-card relative overflow-hidden rounded-3xl border border-accent/15 bg-muted/10 shadow-[0_26px_56px_-32px_rgba(0,0,0,0.6)]">
                    <div className="relative aspect-[16/9] w-full">
                      <Image
                        src={image.src}
                        alt={image.alt}
                        fill
                        className="gallery-image object-cover object-center"
                        sizes="(min-width: 1280px) 60rem, (min-width: 768px) 80vw, 92vw"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

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

          <div className="gallery-dots mt-0.5 flex h-4 items-center justify-center gap-1.5">
            {gallery.map((_, index) => (
              <button
                key={`dot-${index}`}
                type="button"
                aria-label={`Ir a la imagen ${index + 1}`}
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

      </Container>

      {activeCatalogModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4 py-4 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="Cerrar seleccion"
            onClick={closeCatalogModal}
            className="absolute inset-0 h-full w-full cursor-default"
          />
          <div className="relative z-10 w-full max-w-3xl rounded-3xl border border-accent/20 bg-bg p-4 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.75)] md:p-6">
            <button
              type="button"
              onClick={closeCatalogModal}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent/20 text-accent/70 transition hover:border-accent/40 hover:text-accent"
              aria-label="Cerrar modal de seleccion"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center justify-between gap-3 pr-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
                {activeCatalogModal === "included" ? "Incluidos" : "Extras"}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {activeCatalogItems.map((item, index) => {
                const isSelected =
                  selectedCatalogItem?.type === activeCatalogModal &&
                  selectedCatalogItem.index === index;

                return (
                  <button
                    type="button"
                    key={`${item}-${index}`}
                    onClick={() =>
                      selectCatalogItem(index, item, activeCatalogModal)
                    }
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                      isSelected
                        ? "border-accent bg-accent text-bg"
                        : "border-accent/25 bg-bg text-fg hover:border-accent"
                    }`}
                  >
                    <span className="button-label">{item}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-accent/20 bg-bg/80 p-4">
              {isSelectedCatalogItem ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    {activeCatalogModal === "included" ? "Incluido" : "Extra"}
                  </p>
                  <h3 className="mt-2 font-display text-2xl uppercase tracking-[0.08em] text-fg">
                    {selectedCatalogItem.label}
                  </h3>
                  <p className="mt-2 text-sm text-muted">
                    {activeCatalogModal === "included"
                      ? studio.included.subtitle
                      : studio.extras.subtitle}
                  </p>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-accent/20 bg-bg">
                    {selectedCatalogImageSrc ? (
                      <img
                        src={selectedCatalogImageSrc}
                        alt={selectedCatalogImageAlt}
                        className="h-52 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-52 items-center justify-center px-4 text-center text-sm text-muted">
                        Sin imagen de referencia para esta opcion.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted">
                  Elegi una opcion para visualizar su detalle.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isPlanOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4 py-4 backdrop-blur-[2px]">
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

      {isLocationOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4 py-4 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="Cerrar ubicacion"
            onClick={closeLocationModal}
            className="absolute inset-0 h-full w-full cursor-default"
          />
          <div className="relative z-10 w-full max-w-5xl rounded-3xl border border-accent/20 bg-bg p-4 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.75)] md:p-6">
            <button
              type="button"
              onClick={closeLocationModal}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent/20 text-accent/70 transition hover:border-accent/40 hover:text-accent"
              aria-label="Cerrar modal de ubicacion"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center justify-between gap-3 pr-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
                Ubicacion
              </p>
            </div>

            <div className="map-embed-shell mt-4 overflow-hidden rounded-2xl border border-accent/24 bg-bg/85">
              <iframe
                title={`Mapa de ${studio.name}`}
                src={mapEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="map-embed-frame h-[62dvh] min-h-[320px] w-full sm:h-[66dvh]"
              />
              <div className="map-embed-overlay" aria-hidden="true" />
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                {mapAddressLabel}
              </p>
              <a
                href={mapOpenUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-9 items-center justify-center rounded-full border border-accent/30 px-4 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
              >
                <span className="button-label">Abrir</span>
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

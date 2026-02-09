import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";

type MapSectionProps = {
  studio: StudioContent;
};

const buildEmbedUrl = (locationUrl: string, fallbackQuery: string) => {
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

export default function MapSection({ studio }: MapSectionProps) {
  const locationUrl = studio.contact.locationUrl || "";
  const locationText = (studio.contact.locationText || "").trim();
  const isPlaceholderText =
    locationText === "(Sumar dirección)" || locationText === "(Sumar direcciÃ³n)";
  const hasLocationText =
    Boolean(locationText) &&
    !isPlaceholderText &&
    locationText.toLowerCase() !== studio.name.trim().toLowerCase();
  const embedQuery = hasLocationText ? locationText : studio.name;
  const embedUrl = buildEmbedUrl(locationUrl, embedQuery);

  return (
    <section className="bg-bg py-14 md:py-20">
      <Container>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl uppercase tracking-[0.08em] text-fg">
              Donde estamos
            </h2>
            {hasLocationText ? (
              <p className="mt-2 text-sm text-muted">{locationText}</p>
            ) : null}
          </div>
          <a
            href={locationUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-accent/30 bg-bg px-5 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
          >
            Abrir en Google Maps
          </a>
        </div>

        <div className="map-embed-shell overflow-hidden rounded-3xl border border-accent/15 bg-bg shadow-[0_28px_60px_-40px_rgba(0,0,0,0.6)]">
          <iframe
            title="Mapa"
            src={embedUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="map-embed-frame h-[420px] w-full"
          />
          <div className="map-embed-overlay" aria-hidden="true" />
        </div>
      </Container>
    </section>
  );
}


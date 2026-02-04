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
  const locationText =
    studio.contact.locationText && studio.contact.locationText !== "(Sumar dirección)"
      ? studio.contact.locationText
      : studio.name;
  const embedUrl = buildEmbedUrl(locationUrl, locationText);

  return (
    <section className="bg-bg py-14 md:py-20">
      <Container>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
              Ubicacion
            </p>
            <h2 className="font-display text-3xl uppercase tracking-[0.08em] text-fg">
              Donde estamos
            </h2>
            <p className="mt-2 text-sm text-muted">{locationText}</p>
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

        <div className="overflow-hidden rounded-3xl border border-accent/15 bg-bg shadow-[0_28px_60px_-40px_rgba(0,0,0,0.6)]">
          <iframe
            title="Mapa"
            src={embedUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-[420px] w-full"
          />
        </div>
      </Container>
    </section>
  );
}

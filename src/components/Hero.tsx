import Container from "@/components/Container";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import type { StudioContent } from "@/content/studio";

type HeroProps = {
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

const buildMapsLink = (locationUrl: string, fallbackQuery: string) => {
  if (locationUrl) return locationUrl;
  return `https://maps.google.com/maps?q=${encodeURIComponent(fallbackQuery)}`;
};

export default function Hero({ studio }: HeroProps) {
  const bookingLink = "/reservar";
  const primaryCta =
    studio.ctas.primary.replace(/\s*por\s*whats?app/i, "").trim() || "Reservar";
  const instagramUrl =
    studio.contact.instagram || "https://www.instagram.com/unkt.estudio/";
  const whatsappUrl = buildWhatsAppLink(
    studio.contact.whatsapp.phone,
    studio.contact.whatsapp.message
  );
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
  const mapsLink = buildMapsLink(locationUrl, embedQuery);

  return (
    <section className="relative overflow-hidden bg-bg py-16 md:py-24">
      <Container className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-6">
          <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-fg sm:text-5xl md:text-6xl">
            {studio.hero.title}
          </h1>
          <p className="max-w-md text-lg text-muted">{studio.hero.subtitle}</p>
          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bg shadow-[0_12px_24px_-12px_rgba(0,0,0,0.6)] transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
              href={bookingLink}
            >
              {primaryCta}
            </a>
            <a
              className="inline-flex items-center justify-center rounded-full border border-accent/40 bg-bg px-6 py-3 text-sm font-semibold uppercase tracking-wide text-accent shadow-[0_12px_24px_-18px_rgba(0,0,0,0.4)] transition hover:border-accent hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
              href={instagramUrl}
              target="_blank"
              rel="noreferrer"
            >
              Instagram
            </a>
            <a
              className="inline-flex items-center justify-center rounded-full border border-accent/40 bg-bg px-6 py-3 text-sm font-semibold uppercase tracking-wide text-accent shadow-[0_12px_24px_-18px_rgba(0,0,0,0.4)] transition hover:border-accent hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-3xl border border-accent/20 bg-white/70 p-3 shadow-[0_26px_56px_-42px_rgba(30,15,20,0.65)] backdrop-blur transition hover:border-accent/40">
          <div className="map-embed-shell overflow-hidden rounded-2xl border border-accent/20 bg-bg">
            <iframe
              title="Mapa"
              src={embedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="map-embed-frame h-[360px] w-full"
            />
            <div className="map-embed-overlay" aria-hidden="true" />
          </div>
          <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-accent/20 bg-bg/90 px-4 py-3 backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
              Ubicacion
            </p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-fg">
                {hasLocationText ? locationText : "Ver en Google Maps"}
              </p>
              <a
                href={mapsLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-accent/35 bg-bg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
              >
                Abrir
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";

type MapSectionProps = {
  studio: StudioContent;
};

const stripAccents = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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
  const normalizedLocation = stripAccents(locationText.toLowerCase());
  const isPlaceholderText = normalizedLocation.includes("(sumar direccion");
  const hasLocationText =
    Boolean(locationText) &&
    !isPlaceholderText &&
    locationText.toLowerCase() !== studio.name.trim().toLowerCase();
  const embedQuery = hasLocationText ? locationText : studio.name;
  const embedUrl = buildEmbedUrl(locationUrl, embedQuery);
  const cardClassName =
    "group relative overflow-hidden rounded-3xl border-[1.5px] border-accent/26 bg-bg/90 p-2 shadow-[0_24px_48px_-36px_rgba(28,12,18,0.62)] transition hover:border-accent/42 md:p-2.5";
  const mediaShellClassName =
    "map-embed-shell relative overflow-hidden rounded-[1.35rem] border border-accent/24 bg-bg/85";
  const labelClassName =
    "mt-2 inline-flex w-full items-center justify-center rounded-full border-[1.5px] border-accent/26 bg-bg px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent md:mt-2.5 md:py-2.5";

  return (
    <section className="bg-bg pt-4 pb-4 md:pt-10 md:pb-10">
      <Container>
        <div className="mx-auto w-full max-w-3xl">
          <div className={cardClassName}>
            <div className={mediaShellClassName}>
              <iframe
                title="Mapa"
                src={embedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="map-embed-frame h-[205px] w-full sm:h-[235px]"
              />
              <div className="map-embed-overlay" aria-hidden="true" />
            </div>
            <p className={labelClassName}>Ubicacion</p>
          </div>
        </div>
      </Container>
    </section>
  );
}

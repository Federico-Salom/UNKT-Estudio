import Container from "@/components/Container";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import type { StudioContent } from "@/content/studio";

type HeroProps = {
  studio: StudioContent;
};

export default function Hero({ studio }: HeroProps) {
  const bookingLink = "/reservar";
  const primaryCta =
    studio.ctas.primary.replace(/\s*por\s*whats?app/i, "").trim() || "Reservar";
  const instagramUrl = studio.contact.instagram;
  const whatsappUrl = buildWhatsAppLink(
    studio.contact.whatsapp.phone,
    "Hola, tengo una consulta sobre UNKT Estudio."
  );

  return (
    <section className="relative overflow-hidden bg-bg py-16 md:py-24">
      <Container className="grid items-center gap-10">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
            {studio.name}
          </p>
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
      </Container>
    </section>
  );
}

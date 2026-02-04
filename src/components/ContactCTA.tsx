import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";
import { buildWhatsAppLink } from "@/lib/whatsapp";

type ContactCTAProps = {
  studio: StudioContent;
};

export default function ContactCTA({ studio }: ContactCTAProps) {
  const whatsappLink = buildWhatsAppLink(
    studio.contact.whatsapp.phone,
    studio.contact.whatsapp.message
  );

  return (
    <section id="contacto" className="bg-bg py-16 md:py-24">
      <Container className="rounded-3xl border border-accent/30 bg-accent/10 px-6 py-10 md:px-10">
        <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
              {studio.contact.title}
            </p>
            <h2 className="font-display text-4xl uppercase tracking-[0.08em] text-fg">
              {studio.contact.title}
            </h2>
            <p className="text-base text-muted">{studio.contact.note}</p>
            <div className="flex flex-wrap gap-3">
              <a
                className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bg shadow-[0_12px_24px_-12px_rgba(0,0,0,0.6)] transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {studio.ctas.primary}
              </a>
              <a
                className="inline-flex items-center justify-center rounded-full border border-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-accent transition hover:border-accent2 hover:text-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {studio.ctas.secondary}
              </a>
            </div>
          </div>
          <div className="space-y-4 text-sm text-fg">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
                WhatsApp
              </p>
              <a
                className="mt-1 inline-flex text-base font-semibold text-accent hover:text-accent2"
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {studio.contact.whatsapp.phone}
              </a>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
                Correo
              </p>
              <a
                className="mt-1 inline-flex text-base font-semibold text-accent hover:text-accent2"
                href={`mailto:${studio.contact.email}`}
              >
                {studio.contact.email}
              </a>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
                Ubicación
              </p>
              <a
                className="mt-1 inline-flex text-base font-semibold text-accent hover:text-accent2"
                href={studio.contact.locationUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {studio.contact.locationText}
              </a>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
                Horarios
              </p>
              <p className="mt-1 text-base font-semibold text-fg">
                {studio.contact.hours}
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

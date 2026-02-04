import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";
import { buildWhatsAppLink } from "@/lib/whatsapp";

type HeaderProps = {
  studio: StudioContent;
};

export default function Header({ studio }: HeaderProps) {
  const whatsappLink = buildWhatsAppLink(
    studio.contact.whatsapp.phone,
    studio.contact.whatsapp.message
  );

  return (
    <header className="sticky top-0 z-50 border-b border-accent/20 bg-bg/95 backdrop-blur">
      <Container className="flex items-center justify-between py-4">
        <div className="font-display text-2xl uppercase tracking-[0.2em] text-fg">
          {studio.name}
        </div>
        <div className="flex items-center gap-4">
          <a
            className="inline-flex text-sm font-semibold uppercase tracking-wide text-fg/80 transition hover:text-fg"
            href="/login"
          >
            Iniciar sesión
          </a>
          <a
            className="hidden items-center justify-center rounded-full bg-accent px-5 py-2 text-sm font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 md:inline-flex"
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            {studio.ctas.primary}
          </a>
        </div>
      </Container>
    </header>
  );
}

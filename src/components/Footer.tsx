import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";

type FooterProps = {
  studio: StudioContent;
};

export default function Footer({ studio }: FooterProps) {
  return (
    <footer className="border-t border-accent/15 bg-bg py-10">
      <Container className="flex flex-col items-start justify-between gap-4 text-sm text-muted md:flex-row md:items-center">
        <div className="font-display text-lg uppercase tracking-[0.2em] text-fg">
          {studio.name}
        </div>
        <p>{studio.footer.text}</p>
        <a
          className="font-semibold text-accent hover:text-accent2"
          href={`mailto:${studio.contact.email}`}
        >
          {studio.contact.email}
        </a>
      </Container>
    </footer>
  );
}

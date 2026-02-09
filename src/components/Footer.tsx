import Container from "@/components/Container";
import BrandMark from "@/components/BrandMark";
import type { StudioContent } from "@/content/studio";

type FooterProps = {
  studio: StudioContent;
};

export default function Footer({ studio }: FooterProps) {
  return (
    <footer className="border-t border-accent/20 bg-bg/95 py-10 backdrop-blur">
      <Container className="flex flex-col items-start justify-between gap-4 text-sm text-muted md:flex-row md:items-center">
        <BrandMark studio={studio} size={36} showText={false} />
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

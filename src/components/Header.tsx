import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";

type HeaderProps = {
  studio: StudioContent;
};

export default function Header({ studio }: HeaderProps) {
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
        </div>
      </Container>
    </header>
  );
}

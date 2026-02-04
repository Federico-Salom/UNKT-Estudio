import type { StudioContent } from "@/content/studio";
import { buildWhatsAppLink } from "@/lib/whatsapp";

type WhatsAppButtonProps = {
  studio: StudioContent;
};

export default function WhatsAppButton({ studio }: WhatsAppButtonProps) {
  const whatsappLink = buildWhatsAppLink(
    studio.contact.whatsapp.phone,
    studio.contact.whatsapp.message
  );

  return (
    <a
      className="fixed bottom-4 right-4 z-50 inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-xs font-semibold uppercase tracking-wide text-bg shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)] transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 md:hidden"
      href={whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
    >
      WhatsApp
    </a>
  );
}

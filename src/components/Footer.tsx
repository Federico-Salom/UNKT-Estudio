"use client";

import { useState } from "react";
import Container from "@/components/Container";
import type { StudioContent } from "@/content/studio";
import { buildWhatsAppLink } from "@/lib/whatsapp";

type FooterProps = {
  studio: StudioContent;
};

export default function Footer({ studio }: FooterProps) {
  const instagramUrl =
    studio.contact.instagram || "https://www.instagram.com/unkt.estudio/";
  const whatsappUrl = buildWhatsAppLink(
    studio.contact.whatsapp.phone,
    studio.contact.whatsapp.message
  );
  const cancellationPolicy = [
    "Las cancelaciones o reprogramaciones se gestionan por WhatsApp con al menos 24 horas de anticipacion.",
    "Con 24 horas o mas, se permite una unica reprogramacion sin cargo, sujeta a disponibilidad.",
    "Con menos de 24 horas, en caso de no presentarse o llegar con demoras que afecten el turno, no hay reintegro.",
    "Si UNKT Estudio debe cancelar por fuerza mayor, se ofrece reprogramacion prioritaria o reintegro total.",
  ];
  const bookingConditions = [
    "La reserva minima es de 2 horas consecutivas.",
    "Solo se habilitan reservas con un minimo de 2 horas de anticipacion.",
    "La reserva queda confirmada cuando el pago figura acreditado por Mercado Pago.",
    "Los extras se cobran por hora reservada y se asignan segun disponibilidad.",
    "El uso del estudio debe respetar el horario contratado para no afectar los turnos siguientes.",
  ];
  const iconButtonClassName =
    "inline-flex h-11 w-11 items-center justify-center rounded-full border border-accent/30 bg-bg text-accent transition hover:border-accent hover:bg-accent/10";
  const [activePolicyModal, setActivePolicyModal] = useState<
    "cancellation" | "booking" | null
  >(null);
  const [selectedPolicyItem, setSelectedPolicyItem] = useState<{
    type: "cancellation" | "booking";
    text: string;
  } | null>(null);
  const sanitizedFooterText = studio.footer.text
    .replace(/^\s*UNKT\s+Estudio[\s.:,-]*/i, "")
    .trim();
  const footerText = sanitizedFooterText || studio.footer.text;
  const openPolicyModal = (type: "cancellation" | "booking") => {
    setActivePolicyModal(type);
    setSelectedPolicyItem((currentItem) =>
      currentItem?.type === type ? currentItem : null
    );
  };
  const closePolicyModal = () => {
    setActivePolicyModal(null);
  };
  const selectPolicyItem = (type: "cancellation" | "booking", text: string) => {
    setSelectedPolicyItem({ type, text });
  };
  const policyItems =
    activePolicyModal === "cancellation"
      ? cancellationPolicy
      : bookingConditions;
  const policyTitle =
    activePolicyModal === "cancellation"
      ? "Politica de cancelacion"
      : "Condiciones de reserva";
  const selectedText =
    selectedPolicyItem?.type === activePolicyModal
      ? selectedPolicyItem.text
      : "";

  return (
    <footer className="border-t border-accent/20 bg-bg/95 py-8 backdrop-blur md:py-10">
      <Container className="space-y-6">
        <div className="flex flex-col items-center justify-center gap-3 text-center text-sm text-muted">
          <p className="max-w-3xl text-xs leading-relaxed">{footerText}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a
              className={iconButtonClassName}
              href={`mailto:${studio.contact.email}`}
              aria-label="Mail"
              title="Mail"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <path d="m4.5 7 7.5 6 7.5-6" />
              </svg>
              <span className="sr-only">Mail</span>
            </a>
            <a
              className={iconButtonClassName}
              href={instagramUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              title="Instagram"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.5" />
                <circle cx="12" cy="12" r="4.2" />
                <circle cx="17.25" cy="6.75" r="1.2" fill="currentColor" stroke="none" />
              </svg>
              <span className="sr-only">Instagram</span>
            </a>
            <a
              className={iconButtonClassName}
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              title="WhatsApp"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-5 w-5"
                fill="currentColor"
              >
                <path d="M13.601 2.326A7.854 7.854 0 0 0 8.016 0C3.65 0 .084 3.56.084 7.95a7.9 7.9 0 0 0 1.084 3.995L0 16l4.139-1.086a7.9 7.9 0 0 0 3.877 1.02h.003c4.366 0 7.932-3.56 7.932-7.95 0-2.122-.828-4.116-2.35-5.658Zm-5.585 12.3a6.57 6.57 0 0 1-3.356-.92l-.24-.144-2.458.645.656-2.386-.157-.245a6.55 6.55 0 0 1-1.028-3.525c.002-3.63 2.976-6.58 6.633-6.58 1.774 0 3.44.688 4.691 1.943a6.56 6.56 0 0 1 1.944 4.695c-.003 3.63-2.977 6.58-6.635 6.58Zm3.615-4.912c-.197-.099-1.17-.578-1.351-.645-.18-.066-.312-.099-.444.1-.132.198-.51.644-.625.776-.115.132-.23.149-.427.05-.197-.1-.833-.307-1.587-.98-.586-.523-.982-1.17-1.097-1.368-.115-.198-.012-.304.087-.402.09-.088.197-.23.296-.347.099-.116.132-.198.198-.33.066-.132.033-.248-.017-.347-.05-.099-.444-1.07-.608-1.466-.16-.387-.323-.334-.444-.34l-.378-.007a.73.73 0 0 0-.526.248c-.181.198-.69.677-.69 1.651s.707 1.916.806 2.048c.099.132 1.392 2.133 3.372 2.99.471.203.839.325 1.126.416.473.15.904.129 1.244.078.38-.056 1.17-.479 1.335-.942.164-.462.164-.859.115-.942-.05-.084-.181-.132-.378-.231Z" />
              </svg>
              <span className="sr-only">WhatsApp</span>
            </a>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => openPolicyModal("cancellation")}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-white/70 p-4 text-left backdrop-blur transition hover:border-accent/35 hover:bg-white/80"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-fg">
              Politica de cancelacion
            </span>
            <span
              aria-hidden="true"
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent"
            >
              Ver
            </span>
          </button>

          <button
            type="button"
            onClick={() => openPolicyModal("booking")}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-white/70 p-4 text-left backdrop-blur transition hover:border-accent/35 hover:bg-white/80"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-fg">
              Condiciones de reserva
            </span>
            <span
              aria-hidden="true"
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent"
            >
              Ver
            </span>
          </button>
        </div>

        <p className="text-center text-[11px] uppercase tracking-[0.12em] text-muted">
          Al reservar, aceptas estas politicas y condiciones.
        </p>
      </Container>

      {activePolicyModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4 py-4 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="Cerrar politicas"
            onClick={closePolicyModal}
            className="absolute inset-0 h-full w-full cursor-default"
          />
          <div className="relative z-10 w-full max-w-3xl rounded-3xl border border-accent/20 bg-bg p-4 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.75)] md:p-6">
            <button
              type="button"
              onClick={closePolicyModal}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent/20 text-accent/70 transition hover:border-accent/40 hover:text-accent"
              aria-label="Cerrar modal de politicas"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center justify-between gap-3 pr-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
                {policyTitle}
              </p>
            </div>

            <div className="mt-4 grid gap-2">
              {policyItems.map((item, index) => {
                const isSelected = selectedText === item;
                return (
                  <button
                    type="button"
                    key={item}
                    onClick={() => selectPolicyItem(activePolicyModal, item)}
                    className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] transition ${
                      isSelected
                        ? "border-accent bg-accent text-bg"
                        : "border-accent/20 bg-bg/80 text-fg hover:border-accent"
                    }`}
                  >
                    Punto {index + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-accent/20 bg-bg/80 p-4">
              {selectedText ? (
                <p className="text-sm leading-relaxed text-muted">
                  {selectedText}
                </p>
              ) : (
                <p className="text-sm text-muted">
                  Elegi un punto para visualizar su detalle.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </footer>
  );
}

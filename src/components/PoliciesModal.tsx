"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { StudioContent } from "@/content/studio";

type PoliciesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  policies: StudioContent["footer"]["policies"];
};

export default function PoliciesModal({
  isOpen,
  onClose,
  policies,
}: PoliciesModalProps) {
  const policySections = [
    {
      id: "cancellation",
      title: "Politica de cancelacion",
      items: policies.cancellation,
    },
    {
      id: "booking",
      title: "Condiciones de reserva",
      items: policies.booking,
    },
  ] as const;

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 px-3 py-4 backdrop-blur-[2px] sm:px-4 sm:py-6">
      <button
        type="button"
        aria-label="Cerrar politicas"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      <div
        className="relative z-10 flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-accent/20 bg-bg p-4 shadow-[0_34px_70px_-42px_rgba(0,0,0,0.8)] sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="policies-modal-title"
      >
        <button
          type="button"
          onClick={onClose}
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

        <div className="pr-9">
          <p
            id="policies-modal-title"
            className="text-xs font-semibold uppercase tracking-[0.22em] text-muted"
          >
            Politicas y condiciones
          </p>
          <p className="mt-2 text-sm text-muted">
            Lee toda la informacion antes de reservar.
          </p>
        </div>

        <div className="mt-5 max-h-[72dvh] space-y-4 overflow-y-auto pr-1 sm:pr-2">
          {policySections.map((section) => (
            <section
              key={section.id}
              className="rounded-2xl border border-accent/20 bg-bg/90 p-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                {section.title}
              </p>
              <ol className="mt-3 space-y-3">
                {section.items.map((item, index) => (
                  <li key={`${section.id}-${index}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                      Punto {index + 1}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {item}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <p className="text-center text-[11px] uppercase tracking-[0.12em] text-muted">
            Al reservar, aceptas los terminos y condiciones.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

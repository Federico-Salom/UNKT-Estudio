"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CancelBookingButtonProps = {
  bookingId: string;
  className?: string;
};

type CancelBookingResponse = {
  ok?: boolean;
  error?: string;
};

export default function CancelBookingButton({
  bookingId,
  className = "",
}: CancelBookingButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        setOpen(false);
        setError("");
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isSubmitting]);

  const closeModal = () => {
    if (isSubmitting) return;
    setOpen(false);
    setError("");
  };

  const handleCancelBooking = async () => {
    if (!bookingId || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError("");

      const response = await fetch(`/api/booking/${encodeURIComponent(bookingId)}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });
      const data = (await response
        .json()
        .catch(() => ({}))) as CancelBookingResponse;

      if (!response.ok || !data.ok) {
        setError(data.error || "No se pudo cancelar la reserva.");
        setIsSubmitting(false);
        return;
      }

      setOpen(false);
      setIsSubmitting(false);
      router.refresh();
    } catch {
      setError("No se pudo cancelar la reserva.");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError("");
        }}
        className={`inline-flex items-center rounded-full border border-fg/25 bg-bg/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-fg transition hover:border-fg/45 hover:bg-bg/85 ${className}`.trim()}
      >
        Cancelar reserva
      </button>

      {open ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cerrar confirmacion de cancelacion"
            onClick={closeModal}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />

          <section
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-3xl border border-accent/30 bg-bg p-5 text-left shadow-[0_35px_90px_-45px_rgba(0,0,0,0.85)] sm:p-6"
          >
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-fg">
              Cancelar reserva
            </h3>
            <p className="mt-3 text-sm text-muted">
              Esta accion elimina la reserva y libera los horarios. No se puede deshacer.
            </p>

            {error ? (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-accent/35 bg-accent/10 px-3 py-2 text-xs text-accent"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="inline-flex items-center rounded-full border border-fg/25 bg-bg/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-fg transition hover:border-fg/45 hover:bg-bg/85 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCancelBooking}
                disabled={isSubmitting}
                className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-bg transition hover:bg-accent2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Cancelando..." : "Confirmar"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

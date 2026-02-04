"use client";

import { useState } from "react";

type MercadoPagoButtonProps = {
  bookingId: string;
  status: string;
};

export default function MercadoPagoButton({
  bookingId,
  status,
}: MercadoPagoButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (status === "paid") {
    return (
      <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
        Pago confirmado. ¡Gracias!
      </div>
    );
  }

  const handleClick = async () => {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/payments/mercadopago", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ bookingId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "No se pudo iniciar el pago.");
        setLoading(false);
        return;
      }
      const target = data.initPoint || data.sandboxInitPoint;
      if (target) {
        window.location.href = target;
        return;
      }
      setError("No se pudo iniciar el pago.");
      setLoading(false);
    } catch {
      setError("No se pudo iniciar el pago.");
      setLoading(false);
    }
  };

  return (
    <div className="mt-6">
      <button
        className="inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 disabled:cursor-not-allowed disabled:opacity-70"
        type="button"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? "Redirigiendo..." : "Pagar con Mercado Pago"}
      </button>
      {error && (
        <div
          className="mt-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}

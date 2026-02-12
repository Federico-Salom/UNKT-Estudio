"use client";

import { useMemo, useState } from "react";
import { StatusScreen, initMercadoPago } from "@mercadopago/sdk-react";

type StatusScreenBrickProps = {
  paymentId: string;
};

const publicKey =
  process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() || "";

if (publicKey) {
  initMercadoPago(publicKey, { locale: "es-AR" });
}

export default function StatusScreenBrick({ paymentId }: StatusScreenBrickProps) {
  const [brickError, setBrickError] = useState("");

  const customization = useMemo(
    () => ({
      backUrls: {
        return: "/mis-reservas",
        error: "/mis-reservas",
      },
      visual: {
        showExternalReference: true,
      },
    }),
    []
  );

  if (!publicKey) {
    return (
      <div
        className="rounded-2xl border border-accent/35 bg-accent/10 px-4 py-3 text-sm text-accent"
        role="alert"
      >
        Falta configurar NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {brickError && (
        <div
          className="rounded-2xl border border-accent/35 bg-accent/10 px-4 py-3 text-sm text-accent"
          role="alert"
        >
          {brickError}
        </div>
      )}

      <div className="checkout-payment-host rounded-[1.7rem] p-3 sm:p-4">
        <StatusScreen
          initialization={{ paymentId }}
          customization={customization}
          locale="es-AR"
          onError={() => {
            setBrickError("No se pudo cargar el estado del pago.");
          }}
        />
      </div>
    </div>
  );
}

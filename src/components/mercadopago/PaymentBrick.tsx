"use client";

import { useEffect, useMemo, useState } from "react";
import { Payment, initMercadoPago } from "@mercadopago/sdk-react";

type PaymentBrickProps = {
  amount: number;
  title: string;
  payerEmail?: string;
  externalReference?: string;
};

type PreferenceApiResponse = {
  ok?: boolean;
  preferenceId?: string;
  paymentId?: string;
  error?: string;
};

const BRICK_CONTAINER_ID = "checkout-payment-brick";

const publicKey =
  process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() || "";

if (publicKey) {
  initMercadoPago(publicKey, { locale: "es-AR" });
}

export default function PaymentBrick({
  amount,
  title,
  payerEmail,
  externalReference,
}: PaymentBrickProps) {
  const [loadingPreference, setLoadingPreference] = useState(true);
  const [preferenceId, setPreferenceId] = useState("");
  const [error, setError] = useState("");
  const [brickReady, setBrickReady] = useState(false);

  const normalizedPayload = useMemo(
    () => ({
      amount: Math.round(amount),
      title: title.trim(),
      payerEmail: payerEmail?.trim() || undefined,
      externalReference: externalReference?.trim() || undefined,
    }),
    [amount, title, payerEmail, externalReference]
  );

  useEffect(() => {
    let active = true;

    const createPreference = async () => {
      if (!publicKey) {
        if (active) {
          setError("Falta configurar NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY.");
          setLoadingPreference(false);
        }
        return;
      }

      if (!normalizedPayload.title || normalizedPayload.amount <= 0) {
        if (active) {
          setError("No se pudo iniciar el checkout.");
          setLoadingPreference(false);
        }
        return;
      }

      try {
        setLoadingPreference(true);
        setError("");
        setBrickReady(false);
        setPreferenceId("");

        const response = await fetch("/api/mp/preference", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(normalizedPayload),
        });

        const data = (await response
          .json()
          .catch(() => ({}))) as PreferenceApiResponse;

        if (!response.ok || !data.preferenceId) {
          if (active) {
            setError(data.error || "No se pudo crear la preferencia de pago.");
            setLoadingPreference(false);
          }
          return;
        }

        if (active) {
          setPreferenceId(data.preferenceId);
          setLoadingPreference(false);
        }
      } catch {
        if (active) {
          setError("No se pudo crear la preferencia de pago.");
          setLoadingPreference(false);
        }
      }
    };

    void createPreference();

    return () => {
      active = false;
    };
  }, [normalizedPayload]);

  const initialization = useMemo(
    () => ({
      amount: normalizedPayload.amount,
      preferenceId,
      payer: normalizedPayload.payerEmail
        ? {
            email: normalizedPayload.payerEmail,
          }
        : undefined,
    }),
    [normalizedPayload.amount, normalizedPayload.payerEmail, preferenceId]
  );

  const customization = useMemo(
    () => ({
      paymentMethods: {
        mercadoPago: "all" as const,
      },
      visual: {
        style: {
          theme: "flat" as const,
          customVariables: {
            formPadding: "16px",
            borderRadiusMedium: "16px",
            borderRadiusLarge: "20px",
            fontSizeExtraSmall: "0.58rem",
            fontSizeSmall: "0.74rem",
            fontSizeMedium: "0.82rem",
            fontSizeLarge: "0.9rem",
          },
        },
      },
    }),
    []
  );

  if (loadingPreference) {
    return (
      <div className="checkout-summary-item mt-5 rounded-2xl px-4 py-4 text-sm text-muted">
        Preparando checkout seguro...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="mt-5 rounded-2xl border border-accent/35 bg-accent/10 px-4 py-4 text-sm text-accent"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!preferenceId) {
    return (
      <div
        className="mt-5 rounded-2xl border border-accent/35 bg-accent/10 px-4 py-4 text-sm text-accent"
        role="alert"
      >
        No se pudo iniciar el checkout.
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3 checkout-payment-shell">
      {!brickReady && (
        <div className="checkout-summary-item rounded-2xl px-4 py-3 text-sm text-muted">
          Cargando medios de pago...
        </div>
      )}

      <div className="checkout-payment-host rounded-[1.7rem] p-2.5 sm:p-3.5">
        <Payment
          id={BRICK_CONTAINER_ID}
          initialization={initialization}
          customization={customization}
          locale="es-AR"
          onReady={() => {
            setBrickReady(true);
          }}
          onError={() => {
            setError("No se pudo cargar el checkout de Mercado Pago.");
          }}
          onSubmit={async () => {
            return {};
          }}
        />
      </div>

    </div>
  );
}

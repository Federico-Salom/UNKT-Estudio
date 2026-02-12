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
    }),
    []
  );

  if (loadingPreference) {
    return (
      <div className="mt-6 rounded-2xl border border-accent/20 bg-bg px-4 py-4 text-sm text-muted">
        Preparando checkout seguro...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="mt-6 rounded-2xl border border-accent/35 bg-accent/10 px-4 py-4 text-sm text-accent"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!preferenceId) {
    return (
      <div
        className="mt-6 rounded-2xl border border-accent/35 bg-accent/10 px-4 py-4 text-sm text-accent"
        role="alert"
      >
        No se pudo iniciar el checkout.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {!brickReady && (
        <div className="rounded-2xl border border-accent/20 bg-bg px-4 py-3 text-sm text-muted">
          Cargando medios de pago...
        </div>
      )}

      <div className="rounded-3xl border border-accent/20 bg-white/80 p-3 sm:p-4">
        <Payment
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

      <p className="text-xs text-muted">
        En algunos pagos, tu banco puede pedir una verificacion adicional (3DS).
      </p>
    </div>
  );
}

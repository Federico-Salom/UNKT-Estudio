"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  payerEmail?: string | null;
  error?: string;
};

type ProcessPaymentApiResponse = {
  ok?: boolean;
  paymentId?: string;
  status?: string;
  error?: string;
};

const BRICK_CONTAINER_ID = "checkout-payment-brick";
const PAYMENT_METHODS_TITLE_TEXT = "medios de pago";

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const hidePaymentMethodsTitle = (container: HTMLElement | null) => {
  if (!container) return;

  const candidates = container.querySelectorAll<HTMLElement>(
    "h1, h2, h3, h4, p, span, div, label, strong"
  );

  for (const node of candidates) {
    if (normalizeText(node.textContent || "") !== PAYMENT_METHODS_TITLE_TEXT) {
      continue;
    }

    node.style.display = "none";
    node.setAttribute("aria-hidden", "true");
    node.dataset.mpTitleHidden = "true";
    break;
  }
};

const getInitialCompactViewport = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 560px)").matches;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
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
  const [localPaymentId, setLocalPaymentId] = useState("");
  const [resolvedPayerEmail, setResolvedPayerEmail] = useState("");
  const [error, setError] = useState("");
  const [isCompactViewport] = useState(getInitialCompactViewport);

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
        setPreferenceId("");
        setLocalPaymentId("");
        setResolvedPayerEmail("");

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
          setLocalPaymentId(data.paymentId || "");
          setResolvedPayerEmail(data.payerEmail?.trim().toLowerCase() || "");
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

  useEffect(() => {
    if (!preferenceId) return;

    const container = document.getElementById(BRICK_CONTAINER_ID);
    if (!container) return;

    hidePaymentMethodsTitle(container);

    const observer = new MutationObserver(() => {
      hidePaymentMethodsTitle(container);
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [preferenceId]);

  const handleBrickError = useCallback(() => {
    setError("No se pudo cargar el checkout de Mercado Pago.");
  }, []);

  const handleSubmit = useCallback(
    async (submission: { formData?: unknown }) => {
      const formData = asRecord(submission?.formData);
      if (!formData) {
        setError("No recibimos los datos del formulario de pago.");
        return {};
      }

      if (!localPaymentId) {
        setError("No se encontro el pago a procesar.");
        return {};
      }

      try {
        setError("");

        const response = await fetch("/api/mp/payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            paymentId: localPaymentId,
            formData,
          }),
        });

        const data = (await response
          .json()
          .catch(() => ({}))) as ProcessPaymentApiResponse;

        if (!response.ok || !data.ok || !data.paymentId) {
          setError(data.error || "No se pudo procesar el pago.");
          return {};
        }

        window.location.assign(
          `/checkout/estado?payment_id=${encodeURIComponent(data.paymentId)}`
        );

        return data;
      } catch {
        setError("No se pudo procesar el pago.");
        return {};
      }
    },
    [localPaymentId]
  );

  const initialization = useMemo(
    () => ({
      amount: normalizedPayload.amount,
      preferenceId,
      payer: resolvedPayerEmail
        ? {
            email: resolvedPayerEmail,
          }
        : undefined,
    }),
    [normalizedPayload.amount, preferenceId, resolvedPayerEmail]
  );

  const customization = useMemo(() => {
    const compactVariables = isCompactViewport
      ? {
          formPadding: "10px",
          borderRadiusMedium: "14px",
          borderRadiusLarge: "16px",
          inputVerticalPadding: "10px",
          inputHorizontalPadding: "10px",
          fontSizeExtraSmall: "0.54rem",
          fontSizeSmall: "0.68rem",
          fontSizeMedium: "0.78rem",
          fontSizeLarge: "0.86rem",
        }
      : {
          formPadding: "16px",
          borderRadiusMedium: "16px",
          borderRadiusLarge: "20px",
          fontSizeExtraSmall: "0.58rem",
          fontSizeSmall: "0.74rem",
          fontSizeMedium: "0.82rem",
          fontSizeLarge: "0.9rem",
        };

    return {
      paymentMethods: {
        mercadoPago: "all" as const,
      },
      visual: {
        style: {
          theme: "flat" as const,
          customVariables: compactVariables,
        },
      },
    };
  }, [isCompactViewport]);

  if (loadingPreference) {
    return (
      <div className="checkout-summary-item rounded-2xl px-4 py-4 text-sm text-muted">
        Preparando checkout seguro...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-2xl border border-accent/35 bg-accent/10 px-4 py-4 text-sm text-accent"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!preferenceId) {
    return (
      <div
        className="rounded-2xl border border-accent/35 bg-accent/10 px-4 py-4 text-sm text-accent"
        role="alert"
      >
        No se pudo iniciar el checkout.
      </div>
    );
  }

  return (
    <div className="checkout-payment-shell w-full min-w-0 space-y-3">
      <div className="checkout-payment-host w-full min-w-0 rounded-[1.7rem] p-2.5 sm:p-3.5">
        <Payment
          id={BRICK_CONTAINER_ID}
          initialization={initialization}
          customization={customization}
          locale="es-AR"
          onError={handleBrickError}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}

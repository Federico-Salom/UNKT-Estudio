"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";

type MercadoPagoOrderBrickProps = {
  bookingId: string;
  amount: number;
  payerEmail?: string;
  publicKey: string;
};

type CreateOrderApiResponse = {
  ok?: boolean;
  orderId?: string;
  status?: string;
  statusDetail?: string;
  paymentStatus?: string;
  paymentStatusDetail?: string;
  nextActionUrl?: string | null;
  message?: string;
  error?: string;
};

const CARD_PAYMENT_TYPES: Array<"credit_card" | "debit_card" | "prepaid_card"> =
  ["credit_card", "debit_card", "prepaid_card"];

const PENDING_STATUSES = new Set([
  "pending",
  "in_process",
  "authorized",
  "action_required",
  "processing",
]);

const getInitialCompactViewport = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 560px)").matches;
};

const normalizeString = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value).trim();
  return "";
};

const isApprovedStatus = (status: string, statusDetail: string) =>
  status === "approved" || statusDetail === "accredited";

const isPendingStatus = (status: string, statusDetail: string) =>
  PENDING_STATUSES.has(status) || PENDING_STATUSES.has(statusDetail);

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

export default function MercadoPagoOrderBrick({
  bookingId,
  amount,
  payerEmail,
  publicKey,
}: MercadoPagoOrderBrickProps) {
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompactViewport] = useState(getInitialCompactViewport);

  useEffect(() => {
    if (!publicKey) return;
    initMercadoPago(publicKey, { locale: "es-AR" });
  }, [publicKey]);

  const initialization = useMemo(
    () => ({
      amount: Math.max(1, Math.round(amount)),
      payer: payerEmail?.trim()
        ? {
            email: payerEmail.trim().toLowerCase(),
          }
        : undefined,
    }),
    [amount, payerEmail]
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
        types: {
          included: CARD_PAYMENT_TYPES,
        },
      },
      visual: {
        hideFormTitle: true,
        style: {
          theme: "flat" as const,
          customVariables: compactVariables,
        },
      },
    };
  }, [isCompactViewport]);

  const handleSubmit = useCallback(
    async (submission: unknown, additionalData?: unknown) => {
      if (isSubmitting) return;

      const formData = asRecord(submission);
      const extra = asRecord(additionalData);

      if (!formData) {
        setError("No recibimos los datos de la tarjeta.");
        return;
      }

      setIsSubmitting(true);
      setError("");
      setInfo("");

      try {
        const response = await fetch("/api/mp/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            bookingId,
            formData,
            additionalData: extra,
          }),
        });

        const data = (await response
          .json()
          .catch(() => ({}))) as CreateOrderApiResponse;

        if (!response.ok || !data.ok) {
          setError(data.error || data.message || "No se pudo procesar el pago.");
          setIsSubmitting(false);
          return;
        }

        if (data.nextActionUrl) {
          window.location.assign(data.nextActionUrl);
          return;
        }

        const status = normalizeString(data.paymentStatus || data.status).toLowerCase();
        const statusDetail = normalizeString(
          data.paymentStatusDetail || data.statusDetail
        ).toLowerCase();

        if (isApprovedStatus(status, statusDetail)) {
          window.location.assign(
            `/mis-reservas?pago=aprobado&bookingId=${encodeURIComponent(bookingId)}`
          );
          return;
        }

        if (isPendingStatus(status, statusDetail)) {
          setInfo(
            "Pago enviado. Mercado Pago lo esta procesando; te avisaremos cuando se acredite."
          );
          setIsSubmitting(false);
          return;
        }

        setError(data.message || "El pago no fue aprobado.");
        setIsSubmitting(false);
      } catch {
        setError("No se pudo procesar el pago.");
        setIsSubmitting(false);
      }
    },
    [bookingId, isSubmitting]
  );

  const handleBrickError = useCallback(() => {
    setError("No se pudo cargar el formulario de pago.");
  }, []);

  if (!publicKey) {
    return (
      <div
        className="rounded-2xl border border-accent/35 bg-accent/10 px-4 py-4 text-sm text-accent"
        role="alert"
      >
        Falta configurar NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY.
      </div>
    );
  }

  return (
    <div className="checkout-payment-shell w-full min-w-0 space-y-3">
      {error ? (
        <div
          className="rounded-2xl border border-accent/35 bg-accent/10 px-4 py-4 text-sm text-accent"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {info ? (
        <div
          className="rounded-2xl border border-accent/35 bg-accent/10 px-4 py-4 text-sm text-accent"
          role="status"
        >
          {info}
        </div>
      ) : null}

      {isSubmitting ? (
        <div className="checkout-summary-item rounded-2xl px-4 py-4 text-sm text-muted">
          Procesando pago...
        </div>
      ) : (
        <div className="checkout-payment-host w-full min-w-0 rounded-[1.7rem] p-2.5 sm:p-3.5">
          <CardPayment
            id="checkout-order-card-brick"
            initialization={initialization}
            customization={customization}
            locale="es-AR"
            onError={handleBrickError}
            onSubmit={handleSubmit}
          />
        </div>
      )}
    </div>
  );
}

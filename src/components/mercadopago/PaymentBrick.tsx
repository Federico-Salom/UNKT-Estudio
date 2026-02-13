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

const PAY_BUTTON_LABELS = new Set(["pagar", "pay"]);

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

const isPayButton = (node: HTMLElement) => {
  const tagName = node.tagName.toLowerCase();
  const text =
    tagName === "input"
      ? normalizeText((node as HTMLInputElement).value || "")
      : normalizeText(node.textContent || "");

  return PAY_BUTTON_LABELS.has(text);
};

const findPayButton = (container: HTMLElement) => {
  const explicitSubmit = container.querySelector<HTMLElement>(
    "button[type='submit'], input[type='submit']"
  );

  if (explicitSubmit) return explicitSubmit;

  const allButtons = container.querySelectorAll<HTMLElement>(
    "button, input[type='button'], input[type='submit'], [role='button']"
  );

  for (const candidate of allButtons) {
    if (isPayButton(candidate)) return candidate;
  }

  return null;
};

const alignSubmitButtonToRight = (container: HTMLElement | null) => {
  if (!container) return;

  const submitControl = findPayButton(container);

  if (!submitControl) return;

  submitControl.style.marginInlineStart = "auto";
  submitControl.style.alignSelf = "flex-end";
  submitControl.style.marginTop = "0";
  submitControl.style.marginBottom = "0";
  submitControl.style.display = "inline-flex";
  submitControl.style.width = "auto";
  submitControl.style.maxWidth = "100%";
  submitControl.dataset.mpSubmitAligned = "true";

  const form = submitControl.closest("form");
  if (form) {
    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.justifyContent = "flex-start";
    form.style.width = "100%";
    form.dataset.mpFormAligned = "true";

    let actionBlock: HTMLElement | null = submitControl;
    while (actionBlock && actionBlock.parentElement !== form) {
      actionBlock = actionBlock.parentElement;
    }

    if (actionBlock && actionBlock !== form) {
      actionBlock.style.marginTop = "auto";
      actionBlock.style.marginBottom = "0";
      actionBlock.style.marginInlineStart = "auto";
      actionBlock.style.alignSelf = "flex-end";
      actionBlock.style.width = "fit-content";
      actionBlock.style.maxWidth = "100%";
      actionBlock.style.textAlign = "right";
      actionBlock.dataset.mpSubmitRowAligned = "true";
      return;
    }
  }

  const row = submitControl.parentElement;
  if (!row) return;
  row.style.marginTop = "auto";
  row.style.marginBottom = "0";
  row.style.marginInlineStart = "auto";
  row.style.display = "flex";
  row.style.justifyContent = "flex-end";
  row.style.width = "fit-content";
  row.style.maxWidth = "100%";
  row.style.textAlign = "right";
  row.dataset.mpSubmitRowAligned = "true";
};

const hideDuplicatePaymentForms = (container: HTMLElement | null) => {
  if (!container) return;

  const forms = container.querySelectorAll<HTMLElement>(
    "form[class*='mp-checkout-bricks__payment-form'], form[class*='payment-form']"
  );

  if (forms.length <= 1) return;

  forms.forEach((form, index) => {
    if (index === 0) return;
    form.style.display = "none";
    form.setAttribute("aria-hidden", "true");
    form.dataset.mpDuplicateHidden = "true";
  });
};

const getInitialCompactViewport = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 560px)").matches;
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

  useEffect(() => {
    if (!preferenceId) return;

    const container = document.getElementById(BRICK_CONTAINER_ID);
    if (!container) return;

    hideDuplicatePaymentForms(container);
    hidePaymentMethodsTitle(container);
    alignSubmitButtonToRight(container);

    const observer = new MutationObserver(() => {
      hideDuplicatePaymentForms(container);
      hidePaymentMethodsTitle(container);
      alignSubmitButtonToRight(container);
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

  const handleSubmit = useCallback(async () => {
    return {};
  }, []);

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

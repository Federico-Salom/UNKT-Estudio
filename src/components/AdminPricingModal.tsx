"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type ExtraPriceItem = {
  label: string;
  price: number;
};

type AdminPricingModalProps = {
  basePrice: number;
  extras: ExtraPriceItem[];
};

type SaveStatus = "idle" | "saving" | "error";

const parsePriceInput = (value: string) => {
  const digitsOnly = value.replace(/\D/g, "");
  if (!digitsOnly) return Number.NaN;
  const parsed = Number(digitsOnly);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return Math.round(parsed);
};

const formatArs = (value: number) => `$${Math.round(value).toLocaleString("es-AR")}`;

const stripPriceSuffix = (label: string) =>
  label
    .replace(/\s*-\s*\$\s*[\d.,]+/g, "")
    .replace(/\s*-\s*\d+(?:[.,]\d+)?\s*mil\b/gi, "")
    .trim();

export default function AdminPricingModal({
  basePrice,
  extras,
}: AdminPricingModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [basePriceInput, setBasePriceInput] = useState(String(basePrice));
  const [extraPriceInputs, setExtraPriceInputs] = useState<string[]>(
    extras.map((item) => String(item.price))
  );
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const resetForm = () => {
    setBasePriceInput(String(basePrice));
    setExtraPriceInputs(extras.map((item) => String(item.price)));
    setStatus("idle");
    setErrorMessage("");
  };

  const openModal = () => {
    resetForm();
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setStatus("idle");
    setErrorMessage("");
  };

  useEffect(() => {
    if (isOpen) return;
    setBasePriceInput(String(basePrice));
    setExtraPriceInputs(extras.map((item) => String(item.price)));
  }, [basePrice, extras, isOpen]);

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
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isOpen]);

  const normalizedBasePrice = useMemo(
    () => parsePriceInput(basePriceInput),
    [basePriceInput]
  );

  const handleExtraPriceChange = (index: number, value: string) => {
    setExtraPriceInputs((prev) =>
      prev.map((item, currentIndex) => (currentIndex === index ? value : item))
    );
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    const parsedBasePrice = parsePriceInput(basePriceInput);
    const parsedExtraPrices = extraPriceInputs.map(parsePriceInput);

    if (!Number.isFinite(parsedBasePrice) || parsedBasePrice <= 0) {
      setStatus("error");
      setErrorMessage("El precio base debe ser mayor a 0.");
      return;
    }

    if (
      parsedExtraPrices.some(
        (value) => !Number.isFinite(value) || value < 0
      )
    ) {
      setStatus("error");
      setErrorMessage("Revisa los precios de extras.");
      return;
    }

    try {
      const response = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          basePrice: parsedBasePrice,
          extras: parsedExtraPrices,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus("error");
        setErrorMessage(
          typeof data.error === "string"
            ? data.error
            : "No se pudieron guardar los precios."
        );
        return;
      }

      closeModal();
      router.refresh();
    } catch {
      setStatus("error");
      setErrorMessage("No se pudieron guardar los precios.");
    } finally {
      setStatus((current) => (current === "saving" ? "idle" : current));
    }
  };

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full border border-accent/40 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent2 hover:text-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
        onClick={openModal}
      >
        Modificar precios
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-[2px]">
              <button
                type="button"
                aria-label="Cerrar precios"
                onClick={closeModal}
                className="absolute inset-0 h-full w-full cursor-default"
              />

              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-pricing-title"
                className="relative z-10 w-full max-w-2xl rounded-3xl border border-accent/25 bg-bg/95 p-6 text-fg shadow-[0_34px_70px_-42px_rgba(0,0,0,0.8)]"
              >
                <button
                  type="button"
                  onClick={closeModal}
                  className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent/20 text-accent/70 transition hover:border-accent/40 hover:text-accent"
                  aria-label="Cerrar modal de precios"
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

                <p
                  id="admin-pricing-title"
                  className="pr-8 text-sm font-semibold uppercase tracking-[0.18em] text-fg"
                >
                  Modificar precios
                </p>

                <form className="mt-6 grid gap-4" onSubmit={handleSave} noValidate>
                  <label className="grid gap-2 text-sm font-semibold">
                    Precio base por hora
                    <input
                      className="rounded-2xl border border-accent/25 bg-bg px-4 py-3 text-sm text-fg placeholder:text-muted outline-none transition focus:border-accent"
                      type="text"
                      inputMode="numeric"
                      value={basePriceInput}
                      onChange={(event) => setBasePriceInput(event.target.value)}
                      placeholder="40000"
                      required
                    />
                    <span className="text-xs font-medium text-fg/75">
                      Valor actual:{" "}
                      {Number.isFinite(normalizedBasePrice)
                        ? formatArs(normalizedBasePrice)
                        : "invalido"}
                    </span>
                  </label>

                  <div className="grid gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      Extras
                    </p>
                    {extras.length === 0 ? (
                      <div className="rounded-2xl border border-accent/15 bg-bg/80 px-4 py-3 text-sm text-muted">
                        No hay extras configurados.
                      </div>
                    ) : (
                      extras.map((extra, index) => {
                        const parsedPrice = parsePriceInput(extraPriceInputs[index] || "");
                        return (
                          <label
                            key={`${extra.label}-${index}`}
                            className="grid gap-2 rounded-2xl border border-accent/20 bg-bg/70 p-4 text-sm font-semibold"
                          >
                            <span>{stripPriceSuffix(extra.label) || `Extra ${index + 1}`}</span>
                            <input
                              className="rounded-2xl border border-accent/25 bg-bg px-4 py-2 text-sm text-fg placeholder:text-muted outline-none transition focus:border-accent"
                              type="text"
                              inputMode="numeric"
                              value={extraPriceInputs[index] || ""}
                              onChange={(event) =>
                                handleExtraPriceChange(index, event.target.value)
                              }
                              placeholder="0"
                            />
                            <span className="text-xs font-medium text-fg/75">
                              {Number.isFinite(parsedPrice)
                                ? formatArs(parsedPrice)
                                : "invalido"}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>

                  {errorMessage ? (
                    <div
                      role="alert"
                      className="rounded-2xl border border-accent/35 bg-accent/10 px-4 py-3 text-sm text-accent"
                    >
                      {errorMessage}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="inline-flex items-center justify-center rounded-full border border-accent/30 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={status === "saving"}
                      className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {status === "saving" ? "Guardando..." : "Guardar precios"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

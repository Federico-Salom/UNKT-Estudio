"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { ServiceCatalog } from "@/content/studio";
import { formatExtraPriceLabel } from "@/lib/booking";

type ExtraPriceItem = {
  id: string;
  color: string;
  priceSinPisar: number;
  pricePisando: number;
};

type ServiceOptionPriceInput = {
  id: string;
  label: string;
  price: string;
};

type ServicePriceInputs = {
  photographyOptions: ServiceOptionPriceInput[];
  makeupOptions: ServiceOptionPriceInput[];
  stylingOptions: ServiceOptionPriceInput[];
  artDirectionOptions: ServiceOptionPriceInput[];
  modelRatePerHour: string;
  hairstyleRatePerModel: string;
  lightOperatorRatePerHour: string;
  assistantsRatePerHour: string;
};

type AdminPricingModalProps = {
  basePrice: number;
  extras: ExtraPriceItem[];
  services: ServiceCatalog;
  triggerClassName?: string;
};

type SaveStatus = "idle" | "saving" | "error";

const parsePriceInput = (value: string) => {
  const digitsOnly = value.replace(/\D/g, "");
  if (!digitsOnly) return Number.NaN;
  const parsed = Number(digitsOnly);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return Math.round(parsed);
};

const formatArs = (value: number) => formatExtraPriceLabel(value);

const mapOptionInputs = (options: ServiceCatalog["photographyOptions"]) =>
  options.map((item) => ({
    id: item.id,
    label: item.label,
    price: String(item.price),
  }));

const buildServicePriceInputs = (services: ServiceCatalog): ServicePriceInputs => ({
  photographyOptions: mapOptionInputs(services.photographyOptions),
  makeupOptions: mapOptionInputs(services.makeupOptions),
  stylingOptions: mapOptionInputs(services.stylingOptions),
  artDirectionOptions: mapOptionInputs(services.artDirectionOptions),
  modelRatePerHour: String(services.modelRatePerHour),
  hairstyleRatePerModel: String(services.hairstyleRatePerModel),
  lightOperatorRatePerHour: String(services.lightOperatorRatePerHour),
  assistantsRatePerHour: String(services.assistantsRatePerHour),
});

export default function AdminPricingModal({
  basePrice,
  extras,
  services,
  triggerClassName,
}: AdminPricingModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [basePriceInput, setBasePriceInput] = useState(String(basePrice));
  const [extraPriceInputs, setExtraPriceInputs] = useState(
    extras.map((item) => ({
      id: item.id,
      color: item.color,
      priceSinPisar: String(item.priceSinPisar),
      pricePisando: String(item.pricePisando),
    }))
  );
  const [servicePriceInputs, setServicePriceInputs] = useState<ServicePriceInputs>(
    buildServicePriceInputs(services)
  );
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const resetForm = () => {
    setBasePriceInput(String(basePrice));
    setExtraPriceInputs(
      extras.map((item) => ({
        id: item.id,
        color: item.color,
        priceSinPisar: String(item.priceSinPisar),
        pricePisando: String(item.pricePisando),
      }))
    );
    setServicePriceInputs(buildServicePriceInputs(services));
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
    setExtraPriceInputs(
      extras.map((item) => ({
        id: item.id,
        color: item.color,
        priceSinPisar: String(item.priceSinPisar),
        pricePisando: String(item.pricePisando),
      }))
    );
    setServicePriceInputs(buildServicePriceInputs(services));
  }, [basePrice, extras, services, isOpen]);

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

  const handleExtraPriceChange = (
    index: number,
    key: "priceSinPisar" | "pricePisando",
    value: string
  ) => {
    setExtraPriceInputs((prev) =>
      prev.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [key]: value } : item
      )
    );
  };

  const handleServiceOptionPriceChange = (
    key: keyof Pick<
      ServicePriceInputs,
      "photographyOptions" | "makeupOptions" | "stylingOptions" | "artDirectionOptions"
    >,
    index: number,
    value: string
  ) => {
    setServicePriceInputs((prev) => ({
      ...prev,
      [key]: prev[key].map((item, currentIndex) =>
        currentIndex === index ? { ...item, price: value } : item
      ),
    }));
  };

  const handleRateChange = (
    key: keyof Pick<
      ServicePriceInputs,
      | "modelRatePerHour"
      | "hairstyleRatePerModel"
      | "lightOperatorRatePerHour"
      | "assistantsRatePerHour"
    >,
    value: string
  ) => {
    setServicePriceInputs((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const parseOptionGroup = (options: ServiceOptionPriceInput[]) =>
    options.map((item) => ({
      id: item.id,
      price: parsePriceInput(item.price),
    }));

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    const parsedBasePrice = parsePriceInput(basePriceInput);
    const parsedExtraPrices = extraPriceInputs.map((item) => ({
      id: item.id,
      priceSinPisar: parsePriceInput(item.priceSinPisar),
      pricePisando: parsePriceInput(item.pricePisando),
    }));

    if (!Number.isFinite(parsedBasePrice) || parsedBasePrice <= 0) {
      setStatus("error");
      setErrorMessage("El precio base debe ser mayor a 0.");
      return;
    }

    if (
      parsedExtraPrices.some(
        (item) =>
          !Number.isFinite(item.priceSinPisar) ||
          item.priceSinPisar < 0 ||
          !Number.isFinite(item.pricePisando) ||
          item.pricePisando < 0
      )
    ) {
      setStatus("error");
      setErrorMessage("Revisa los precios de extras.");
      return;
    }

    const parsedServices = {
      photographyOptions: parseOptionGroup(servicePriceInputs.photographyOptions),
      makeupOptions: parseOptionGroup(servicePriceInputs.makeupOptions),
      stylingOptions: parseOptionGroup(servicePriceInputs.stylingOptions),
      artDirectionOptions: parseOptionGroup(servicePriceInputs.artDirectionOptions),
      rates: {
        modelRatePerHour: parsePriceInput(servicePriceInputs.modelRatePerHour),
        hairstyleRatePerModel: parsePriceInput(servicePriceInputs.hairstyleRatePerModel),
        lightOperatorRatePerHour: parsePriceInput(
          servicePriceInputs.lightOperatorRatePerHour
        ),
        assistantsRatePerHour: parsePriceInput(
          servicePriceInputs.assistantsRatePerHour
        ),
      },
    };

    const hasInvalidServiceOptions = [
      ...parsedServices.photographyOptions,
      ...parsedServices.makeupOptions,
      ...parsedServices.stylingOptions,
      ...parsedServices.artDirectionOptions,
    ].some((item) => !Number.isFinite(item.price) || item.price < 0);

    if (hasInvalidServiceOptions) {
      setStatus("error");
      setErrorMessage("Revisa los precios de opciones de servicios.");
      return;
    }

    if (
      Object.values(parsedServices.rates).some(
        (value) => !Number.isFinite(value) || value < 0
      )
    ) {
      setStatus("error");
      setErrorMessage("Revisa las tarifas por categoria de servicios.");
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
          services: parsedServices,
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

  const renderServiceOptionsGroup = ({
    title,
    options,
    keyName,
  }: {
    title: string;
    options: ServiceOptionPriceInput[];
    keyName: keyof Pick<
      ServicePriceInputs,
      "photographyOptions" | "makeupOptions" | "stylingOptions" | "artDirectionOptions"
    >;
  }) => {
    if (!options.length) {
      return (
        <div className="rounded-2xl border border-accent/15 bg-bg/80 px-4 py-3 text-sm text-muted">
          No hay opciones cargadas.
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          {title}
        </p>
        {options.map((item, index) => {
          const parsedValue = parsePriceInput(item.price);
          return (
            <label
              key={item.id}
              className="grid gap-2 rounded-2xl border border-accent/20 bg-bg/70 p-3 text-sm font-semibold"
            >
              <span>{item.label}</span>
              <input
                className="w-full min-w-0 rounded-2xl border border-accent/25 bg-bg px-4 py-2 text-sm text-fg placeholder:text-muted outline-none transition focus:border-accent"
                type="text"
                inputMode="numeric"
                value={item.price}
                onChange={(event) =>
                  handleServiceOptionPriceChange(keyName, index, event.target.value)
                }
                placeholder="0"
              />
              <span className="text-xs font-medium text-fg/75">
                {Number.isFinite(parsedValue) ? formatArs(parsedValue) : "invalido"}
              </span>
            </label>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <button
        type="button"
        className={`inline-flex items-center justify-center rounded-full border border-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent2 hover:text-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 ${
          triggerClassName ?? ""
        }`}
        onClick={openModal}
      >
        Modificar precios
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/65 px-3 py-4 backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-6">
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
                className="relative z-10 w-full max-w-4xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-accent/25 bg-bg/95 p-4 text-fg shadow-[0_34px_70px_-42px_rgba(0,0,0,0.8)] sm:max-h-[calc(100dvh-3rem)] sm:p-6"
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

                <form className="mt-5 grid gap-5 sm:mt-6" onSubmit={handleSave} noValidate>
                  <label className="grid gap-2 text-sm font-semibold">
                    Precio base por hora
                    <input
                      className="w-full min-w-0 rounded-2xl border border-accent/25 bg-bg px-4 py-3 text-sm text-fg placeholder:text-muted outline-none transition focus:border-accent"
                      type="text"
                      inputMode="numeric"
                      value={basePriceInput}
                      onChange={(event) => setBasePriceInput(event.target.value)}
                      placeholder="40000"
                      required
                    />
                    <span className="text-xs font-medium text-fg/75">
                      Valor actual: {Number.isFinite(normalizedBasePrice)
                        ? formatArs(normalizedBasePrice)
                        : "invalido"}
                    </span>
                  </label>

                  <div className="grid gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      Fondos extras
                    </p>
                    {extraPriceInputs.length === 0 ? (
                      <div className="rounded-2xl border border-accent/15 bg-bg/80 px-4 py-3 text-sm text-muted">
                        No hay fondos configurados.
                      </div>
                    ) : (
                      extraPriceInputs.map((extra, index) => {
                        const parsedSinPisar = parsePriceInput(extra.priceSinPisar);
                        const parsedPisando = parsePriceInput(extra.pricePisando);

                        return (
                          <div
                            key={extra.id}
                            className="grid gap-3 rounded-2xl border border-accent/20 bg-bg/70 p-4"
                          >
                            <p className="text-sm font-semibold">{extra.color}</p>

                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="grid gap-2 text-sm font-semibold">
                                Sin pisar
                                <input
                                  className="w-full min-w-0 rounded-2xl border border-accent/25 bg-bg px-4 py-2 text-sm text-fg placeholder:text-muted outline-none transition focus:border-accent"
                                  type="text"
                                  inputMode="numeric"
                                  value={extra.priceSinPisar}
                                  onChange={(event) =>
                                    handleExtraPriceChange(
                                      index,
                                      "priceSinPisar",
                                      event.target.value
                                    )
                                  }
                                  placeholder="0"
                                />
                                <span className="text-xs font-medium text-fg/75">
                                  {Number.isFinite(parsedSinPisar)
                                    ? formatArs(parsedSinPisar)
                                    : "invalido"}
                                </span>
                              </label>

                              <label className="grid gap-2 text-sm font-semibold">
                                Pisando
                                <input
                                  className="w-full min-w-0 rounded-2xl border border-accent/25 bg-bg px-4 py-2 text-sm text-fg placeholder:text-muted outline-none transition focus:border-accent"
                                  type="text"
                                  inputMode="numeric"
                                  value={extra.pricePisando}
                                  onChange={(event) =>
                                    handleExtraPriceChange(
                                      index,
                                      "pricePisando",
                                      event.target.value
                                    )
                                  }
                                  placeholder="0"
                                />
                                <span className="text-xs font-medium text-fg/75">
                                  {Number.isFinite(parsedPisando)
                                    ? formatArs(parsedPisando)
                                    : "invalido"}
                                </span>
                              </label>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="grid gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      Servicios - opciones
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderServiceOptionsGroup({
                        title: "Fotografia",
                        options: servicePriceInputs.photographyOptions,
                        keyName: "photographyOptions",
                      })}
                      {renderServiceOptionsGroup({
                        title: "Maquillaje",
                        options: servicePriceInputs.makeupOptions,
                        keyName: "makeupOptions",
                      })}
                      {renderServiceOptionsGroup({
                        title: "Estilismo",
                        options: servicePriceInputs.stylingOptions,
                        keyName: "stylingOptions",
                      })}
                      {renderServiceOptionsGroup({
                        title: "Direccion de arte",
                        options: servicePriceInputs.artDirectionOptions,
                        keyName: "artDirectionOptions",
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      Servicios - tarifas automaticas
                    </p>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-2 text-sm font-semibold">
                        Modelos (precio por hora por modelo)
                        <input
                          className="w-full min-w-0 rounded-2xl border border-accent/25 bg-bg px-4 py-2 text-sm text-fg placeholder:text-muted outline-none transition focus:border-accent"
                          type="text"
                          inputMode="numeric"
                          value={servicePriceInputs.modelRatePerHour}
                          onChange={(event) =>
                            handleRateChange("modelRatePerHour", event.target.value)
                          }
                          placeholder="0"
                        />
                      </label>

                      <label className="grid gap-2 text-sm font-semibold">
                        Peinado (precio por modelo)
                        <input
                          className="w-full min-w-0 rounded-2xl border border-accent/25 bg-bg px-4 py-2 text-sm text-fg placeholder:text-muted outline-none transition focus:border-accent"
                          type="text"
                          inputMode="numeric"
                          value={servicePriceInputs.hairstyleRatePerModel}
                          onChange={(event) =>
                            handleRateChange(
                              "hairstyleRatePerModel",
                              event.target.value
                            )
                          }
                          placeholder="0"
                        />
                      </label>

                      <label className="grid gap-2 text-sm font-semibold">
                        Operador de luces (precio por hora)
                        <input
                          className="w-full min-w-0 rounded-2xl border border-accent/25 bg-bg px-4 py-2 text-sm text-fg placeholder:text-muted outline-none transition focus:border-accent"
                          type="text"
                          inputMode="numeric"
                          value={servicePriceInputs.lightOperatorRatePerHour}
                          onChange={(event) =>
                            handleRateChange(
                              "lightOperatorRatePerHour",
                              event.target.value
                            )
                          }
                          placeholder="0"
                        />
                      </label>

                      <label className="grid gap-2 text-sm font-semibold">
                        Asistentes (precio por hora por asistente)
                        <input
                          className="w-full min-w-0 rounded-2xl border border-accent/25 bg-bg px-4 py-2 text-sm text-fg placeholder:text-muted outline-none transition focus:border-accent"
                          type="text"
                          inputMode="numeric"
                          value={servicePriceInputs.assistantsRatePerHour}
                          onChange={(event) =>
                            handleRateChange("assistantsRatePerHour", event.target.value)
                          }
                          placeholder="0"
                        />
                      </label>
                    </div>
                  </div>

                  {errorMessage ? (
                    <div
                      role="alert"
                      className="rounded-2xl border border-accent/35 bg-accent/10 px-4 py-3 text-sm text-accent"
                    >
                      {errorMessage}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="inline-flex w-full items-center justify-center rounded-full border border-accent/30 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10 sm:w-auto"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={status === "saving"}
                      className="inline-flex w-full items-center justify-center rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
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

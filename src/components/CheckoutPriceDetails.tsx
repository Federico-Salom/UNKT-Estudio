"use client";

import { useEffect, useMemo, useState } from "react";

type CheckoutExtraLine = {
  label: string;
  amount: number;
};

type CheckoutPriceDetailsProps = {
  total: number;
  basePrice: number;
  hours: number;
  extras: CheckoutExtraLine[];
  services: CheckoutExtraLine[];
  weekendOrHolidaySurcharge: number;
  weekendOrHolidayHours: number;
  nightSurcharge: number;
  nightHours: number;
  adjustment: number;
  buttonClassName?: string;
};

const formatMoney = (value: number) => `$${value.toLocaleString("es-AR")}`;
const formatHours = (value: number) =>
  Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("es-AR", { maximumFractionDigits: 2 });

export default function CheckoutPriceDetails({
  total,
  basePrice,
  hours,
  extras,
  services,
  weekendOrHolidaySurcharge,
  weekendOrHolidayHours,
  nightSurcharge,
  nightHours,
  adjustment,
  buttonClassName,
}: CheckoutPriceDetailsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const baseSubtotal = useMemo(() => basePrice * hours, [basePrice, hours]);
  const extrasSubtotal = useMemo(
    () => extras.reduce((acc, item) => acc + item.amount, 0),
    [extras]
  );
  const servicesSubtotal = useMemo(
    () => services.reduce((acc, item) => acc + item.amount, 0),
    [services]
  );

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
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-full border border-accent/35 bg-bg/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg [overflow-wrap:normal] [word-break:normal] transition hover:border-accent hover:bg-accent/10 ${buttonClassName ?? ""}`.trim()}
      >
        Detalles
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 px-3 py-4 backdrop-blur-[2px] sm:px-4 sm:py-6">
          <button
            type="button"
            aria-label="Cerrar detalle del total"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-price-details-title"
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-accent/20 bg-bg p-4 shadow-[0_34px_70px_-42px_rgba(0,0,0,0.8)] sm:p-6"
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent/20 text-accent/70 transition hover:border-accent/40 hover:text-accent"
              aria-label="Cerrar modal de detalles"
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

            <div className="pr-8">
              <p
                id="checkout-price-details-title"
                className="text-xs font-semibold uppercase tracking-[0.2em] text-muted"
              >
                Desglose del total
              </p>
              <p className="mt-2 text-sm text-muted">
                Este es el detalle completo de tu reserva.
              </p>
            </div>

            <div className="mt-4 space-y-2 rounded-2xl border border-accent/20 bg-white/70 p-3">
              <div className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-semibold text-fg">Base por hora</p>
                  <p className="text-xs text-muted">
                    {formatMoney(basePrice)} x {hours} {hours === 1 ? "hora" : "horas"}
                  </p>
                </div>
                <p className="font-semibold text-fg">{formatMoney(baseSubtotal)}</p>
              </div>

              <div className="h-px bg-accent/15" />

              {weekendOrHolidaySurcharge > 0 ? (
                <div className="flex items-start justify-between gap-3 text-sm text-fg">
                  <div>
                    <p className="font-semibold">Recargo finde/feriado (+30%)</p>
                    <p className="text-xs text-muted">
                      Aplica sobre {formatHours(weekendOrHolidayHours)}{" "}
                      {weekendOrHolidayHours === 1 ? "hora" : "horas"}.
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatMoney(weekendOrHolidaySurcharge)}
                  </p>
                </div>
              ) : null}

              {nightSurcharge > 0 ? (
                <div className="flex items-start justify-between gap-3 text-sm text-fg">
                  <div>
                    <p className="font-semibold">Recargo nocturno (+40%)</p>
                    <p className="text-xs text-muted">
                      Franja 22:00 a 08:00 sobre {formatHours(nightHours)}{" "}
                      {nightHours === 1 ? "hora" : "horas"}.
                    </p>
                  </div>
                  <p className="font-semibold">{formatMoney(nightSurcharge)}</p>
                </div>
              ) : null}

              {weekendOrHolidaySurcharge > 0 || nightSurcharge > 0 ? (
                <div className="h-px bg-accent/15" />
              ) : null}

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Fondos
                </p>
                {extras.length ? (
                  extras.map((extra) => (
                    <div
                      key={extra.label}
                      className="flex items-start justify-between gap-3 text-sm text-fg"
                    >
                      <p className="max-w-[72%]">{extra.label}</p>
                      <p className="font-semibold">{formatMoney(extra.amount)}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-between text-sm text-fg">
                    <p>Sin fondos</p>
                    <p className="font-semibold">{formatMoney(0)}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-sm text-fg">
                <p className="font-semibold">Subtotal fondos</p>
                <p className="font-semibold">{formatMoney(extrasSubtotal)}</p>
              </div>

              <div className="h-px bg-accent/15" />

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Servicios
                </p>
                {services.length ? (
                  services.map((service) => (
                    <div
                      key={service.label}
                      className="flex items-start justify-between gap-3 text-sm text-fg"
                    >
                      <p className="max-w-[72%]">{service.label}</p>
                      <p className="font-semibold">{formatMoney(service.amount)}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-between text-sm text-fg">
                    <p>Sin servicios</p>
                    <p className="font-semibold">{formatMoney(0)}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-sm text-fg">
                <p className="font-semibold">Subtotal servicios</p>
                <p className="font-semibold">{formatMoney(servicesSubtotal)}</p>
              </div>

              {adjustment !== 0 ? (
                <div className="flex items-center justify-between text-sm text-fg">
                  <p className="font-semibold">Ajuste de reserva</p>
                  <p className="font-semibold">{formatMoney(adjustment)}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent/80">
                Total
              </p>
              <p className="font-display text-3xl leading-none text-accent">
                {formatMoney(total)}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

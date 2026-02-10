"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import PoliciesModal from "@/components/PoliciesModal";
import { BOOKING_TIMEZONE } from "@/lib/booking";

type SlotOption = {
  id: string;
  start: string;
  end: string;
};

type BookingFormProps = {
  slots: SlotOption[];
  extras: string[];
  basePrice: number;
  extraPrices: Record<string, number>;
};

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BOOKING_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: BOOKING_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const humanDateFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: BOOKING_TIMEZONE,
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const normalizeIso = (value: string) =>
  value.length === 10 ? `${value}T00:00:00` : value;
const toDate = (value: string) => new Date(normalizeIso(value));

const getDateKey = (value: string) => dateKeyFormatter.format(toDate(value));
const getDateKeyFromDate = (value: Date) => dateKeyFormatter.format(value);
const formatTime = (value: string) => timeFormatter.format(toDate(value));
const formatRangeLabel = (start: string, end: string) =>
  `${formatTime(start)} - ${formatTime(end)}`;
const getSlotStartTime = (slot: SlotOption) => toDate(slot.start).getTime();
const getSlotEndTime = (slot: SlotOption) => toDate(slot.end).getTime();
const sortSlotsByStart = (slotA: SlotOption, slotB: SlotOption) =>
  getSlotStartTime(slotA) - getSlotStartTime(slotB);
const areConsecutiveSlots = (selectedSlots: SlotOption[]) =>
  selectedSlots.every((slot, index) => {
    if (index === 0) return true;
    return getSlotEndTime(selectedSlots[index - 1]) === getSlotStartTime(slot);
  });

export default function BookingForm({
  slots,
  extras,
  basePrice,
  extraPrices,
}: BookingFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [selectedExtra, setSelectedExtra] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [apiError, setApiError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  const extrasTotal = useMemo(
    () => (selectedExtra ? extraPrices[selectedExtra] ?? 0 : 0),
    [extraPrices, selectedExtra]
  );
  const total = useMemo(
    () => basePrice * Math.max(selectedSlotIds.length, 1) + extrasTotal,
    [basePrice, extrasTotal, selectedSlotIds.length]
  );

  const groupedSlots = useMemo(() => {
    const map = new Map<string, SlotOption[]>();
    slots.forEach((slot) => {
      const key = getDateKey(slot.start);
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    });
    map.forEach((list, key) => {
      list.sort(sortSlotsByStart);
      map.set(key, list);
    });
    return map;
  }, [slots]);

  const calendarEvents = useMemo(() => {
    return Array.from(groupedSlots.entries()).map(([dateKey, list]) => ({
      id: dateKey,
      title: `${list.length} disponible${list.length === 1 ? "" : "s"}`,
      start: dateKey,
      allDay: true,
    }));
  }, [groupedSlots]);

  const selectedSlots = selectedDate
    ? groupedSlots.get(selectedDate) ?? []
    : [];

  const slotById = useMemo(
    () => new Map(slots.map((slot) => [slot.id, slot])),
    [slots]
  );

  const selectedSlotCount = selectedSlotIds.length;
  const selectedSlotsForLabel = useMemo(
    () =>
      selectedSlotIds
        .map((slotId) => slotById.get(slotId))
        .filter((slot): slot is SlotOption => Boolean(slot))
        .sort(sortSlotsByStart),
    [selectedSlotIds, slotById]
  );
  const isSelectionConsecutive = areConsecutiveSlots(selectedSlotsForLabel);
  const selectedRangeLabel =
    selectedSlotsForLabel.length > 0
      ? formatRangeLabel(
          selectedSlotsForLabel[0].start,
          selectedSlotsForLabel[selectedSlotsForLabel.length - 1].end
        )
      : null;

  const getNameError = () => (!name ? "Escribe tu nombre." : null);

  const getPhoneError = () => (!phone ? "Escribe tu teléfono." : null);

  const getSlotError = () => {
    if (selectedSlotIds.length === 0) {
      return "Selecciona horarios disponibles.";
    }
    if (selectedSlotIds.length < 2) {
      return "La reserva mínima es de 2 horas consecutivas.";
    }
    if (!isSelectionConsecutive) {
      return "Las horas seleccionadas deben ser consecutivas.";
    }
    return null;
  };

  const toggleSlotSelection = (slotId: string) => {
    const nextSlotIds = selectedSlotIds.includes(slotId)
      ? selectedSlotIds.filter((item) => item !== slotId)
      : [...selectedSlotIds, slotId];
    const nextSelectedSlots = nextSlotIds
      .map((id) => slotById.get(id))
      .filter((slot): slot is SlotOption => Boolean(slot))
      .sort(sortSlotsByStart);

    if (!areConsecutiveSlots(nextSelectedSlots)) {
      setApiError("Las horas seleccionadas deben ser consecutivas.");
      return;
    }

    setApiError("");
    setSelectedSlotIds(nextSlotIds);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);

    const errors = [
      getNameError(),
      getPhoneError(),
      getSlotError(),
    ].filter(Boolean);

    if (errors.length) return;

    setStatus("loading");
    setApiError("");

    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
          slotIds: selectedSlotIds,
          extras: selectedExtra ? [selectedExtra] : [],
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setApiError(data.error || "No se pudo crear la reserva.");
        setStatus("idle");
        return;
      }

      const redirectTo =
        typeof data.redirectTo === "string" ? data.redirectTo : "/account";
      router.push(redirectTo);
    } catch {
      setApiError("No se pudo crear la reserva.");
      setStatus("idle");
    }
  };

  const nameError = attempted ? getNameError() : null;
  const phoneError = attempted ? getPhoneError() : null;
  const slotError = attempted ? getSlotError() : null;
  const openPolicyModal = () => setIsPolicyModalOpen(true);
  const closePolicyModal = () => setIsPolicyModalOpen(false);

  const inputClass = (invalid: boolean) =>
    [
      "rounded-2xl border px-4 py-3 text-sm text-fg placeholder:text-muted outline-none transition focus:border-accent",
      invalid ? "border-accent bg-accent/10" : "border-accent/20 bg-white",
    ].join(" ");

  return (
    <form
      className="booking-form mt-6 grid gap-4"
      onSubmit={handleSubmit}
      noValidate
    >
      {apiError && (
        <div
          className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent"
          role="alert"
        >
          {apiError}
        </div>
      )}

      <label className="grid gap-2 text-sm font-semibold">
        Nombre
        <input
          className={inputClass(Boolean(nameError))}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        {nameError && <span className="text-xs text-accent">{nameError}</span>}
      </label>

      <label className="grid gap-2 text-sm font-semibold">
        Teléfono
        <input
          className={inputClass(Boolean(phoneError))}
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />
        {phoneError && (
          <span className="text-xs text-accent">{phoneError}</span>
        )}
      </label>

      <p className="text-xs text-muted">
        Solo necesitamos tu nombre y teléfono. El resto lo cargamos luego.
      </p>

      <div className="grid gap-3">
        <p className="text-sm font-semibold">Seleccioná un día</p>
        <p className="text-xs text-muted">
          La reserva mínima es de 2 horas consecutivas. Además, se reserva 1
          hora posterior para mantenimiento.
        </p>
        <div className="booking-calendar overflow-hidden rounded-2xl border border-accent/15 bg-white/80 p-3">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            locales={[esLocale]}
            locale="es"
            initialView="dayGridMonth"
            events={calendarEvents}
            displayEventTime={false}
            dayCellClassNames={(arg) =>
              selectedDate && getDateKeyFromDate(arg.date) === selectedDate
                ? ["fc-selected-day"]
                : []
            }
            dateClick={(info) => {
              const dateKey = getDateKey(info.dateStr);
              setSelectedDate(dateKey);
              setSelectedSlotIds([]);
              setApiError("");
            }}
            eventClick={(info) => {
              setSelectedDate(info.event.id);
              setSelectedSlotIds([]);
              setApiError("");
            }}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "",
            }}
            height="auto"
          />
        </div>
        {selectedDate && (
          <div className="booking-note rounded-2xl border border-accent/15 bg-bg px-4 py-3 text-sm text-muted">
            Horarios para{" "}
            <span className="font-semibold text-fg">
              {humanDateFormatter.format(
                new Date(`${selectedDate}T00:00:00`)
              )}
            </span>
          </div>
        )}
        {selectedDate && selectedSlots.length === 0 && (
          <div className="booking-note rounded-2xl border border-accent/15 bg-bg px-4 py-3 text-sm text-muted">
            No hay horarios disponibles para este día.
          </div>
        )}
        {selectedSlots.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2">
            {selectedSlots.map((slot) => {
              const label = formatRangeLabel(slot.start, slot.end);
              const isSelected = selectedSlotIds.includes(slot.id);
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => toggleSlotSelection(slot.id)}
                  className={`booking-slot-button rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    isSelected
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-accent/20 bg-white text-fg hover:border-accent hover:bg-accent/5"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        {slotError && (
          <span className="text-xs text-accent">{slotError}</span>
        )}
      </div>

      <div className="booking-extras grid gap-2 rounded-2xl border border-accent/15 bg-white/80 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Extras (elegi una sola variante)
        </p>
        {extras.length === 0 ? (
          <p className="text-sm text-muted">No hay extras configurados.</p>
        ) : (
          <div
            className="grid gap-2"
            role="radiogroup"
            aria-label="Seleccion de extra"
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="booking-extra"
                checked={selectedExtra === null}
                onChange={() => setSelectedExtra(null)}
              />
              Sin extra
            </label>
            {extras.map((extra) => (
              <label key={extra} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="booking-extra"
                  checked={selectedExtra === extra}
                  onChange={() => setSelectedExtra(extra)}
                />
                {extra}
                <span className="text-xs text-muted">
                  (+${(extraPrices[extra] ?? 0).toLocaleString("es-AR")})
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="booking-summary rounded-2xl border border-accent/15 bg-bg px-4 py-3 text-sm">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
          <span>Base</span>
          <span>
            ${basePrice.toLocaleString("es-AR")} x {selectedSlotCount || 1}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
          <span>Extras</span>
          <span>${extrasTotal.toLocaleString("es-AR")}</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-fg">
          <span>Total</span>
          <span>${total.toLocaleString("es-AR")}</span>
        </div>
        {selectedRangeLabel && (
          <div className="mt-2 text-xs text-muted">
            Horario seleccionado:{" "}
            <span className="font-semibold text-fg">
              {selectedRangeLabel}
            </span>
          </div>
        )}
        {selectedSlotCount > 0 && (
          <div className="mt-1 text-xs text-muted">
            Horas seleccionadas:{" "}
            <span className="font-semibold text-fg">
              {selectedSlotCount}
            </span>
          </div>
        )}
        {selectedSlotCount > 1 && (
          <div className="mt-1 text-xs text-muted">
            Se reserva 1 hora posterior para mantenimiento (no se cobra).
          </div>
        )}
      </div>

      <button
        className="booking-submit mt-2 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 disabled:cursor-not-allowed disabled:opacity-70"
        type="submit"
        disabled={
          status === "loading" ||
          slots.length === 0 ||
          selectedSlotIds.length < 2 ||
          !isSelectionConsecutive
        }
      >
        {status === "loading" ? "Procesando..." : "Reservar y pagar"}
      </button>

      <p className="text-center text-[11px] uppercase tracking-[0.12em] text-muted">
        Al reservar, aceptas los{" "}
        <button
          type="button"
          onClick={openPolicyModal}
          className="font-semibold text-accent underline decoration-accent/55 underline-offset-2 transition hover:text-accent2"
        >
          terminos y condiciones
        </button>
        .
      </p>

      <PoliciesModal isOpen={isPolicyModalOpen} onClose={closePolicyModal} />
    </form>
  );
}

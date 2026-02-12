"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import PoliciesModal from "@/components/PoliciesModal";
import type { ExtraBackground, StudioContent } from "@/content/studio";
import {
  BOOKING_TIMEZONE,
  buildExtraSelectionLabel,
  formatExtraPriceLabel,
  resolveExtraMaxSelections,
  type ExtraMode,
} from "@/lib/booking";

type SlotOption = {
  id: string;
  start: string;
  end: string;
};

type BookingFormProps = {
  slots: SlotOption[];
  extraBackgrounds: ExtraBackground[];
  maxExtraSelections: number;
  basePrice: number;
  policies: StudioContent["footer"]["policies"];
  profileName: string;
  profilePhone: string;
  isContactVerified: boolean;
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
const MIN_NAME_LETTERS = 2;
const MAX_NAME_LENGTH = 60;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;
const MAX_PHONE_LENGTH = 24;
const NAME_ALLOWED_CHARS_REGEX = /[^\p{L}\s'-]/gu;
const PHONE_ALLOWED_CHARS_REGEX = /[^\d+\s()-]/g;
const NAME_LETTER_REGEX = /\p{L}/gu;
const PHONE_DIGITS_REGEX = /\D/g;

const normalizeContactValue = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const sanitizeNameInput = (value: string) =>
  normalizeContactValue(value.replace(NAME_ALLOWED_CHARS_REGEX, ""));

const sanitizePhoneInput = (value: string) => {
  const normalized = normalizeContactValue(
    value.replace(PHONE_ALLOWED_CHARS_REGEX, "")
  );

  if (!normalized.includes("+")) return normalized;

  const startsWithPlus = normalized.startsWith("+");
  const withoutPlus = normalized.replace(/\+/g, "");
  return startsWithPlus ? `+${withoutPlus}` : withoutPlus;
};

const getNameLetterCount = (value: string) =>
  (value.match(NAME_LETTER_REGEX) ?? []).length;

const getPhoneDigitsCount = (value: string) =>
  value.replace(PHONE_DIGITS_REGEX, "").length;

const hasPhonePlusInValidPosition = (value: string) => {
  const plusCount = (value.match(/\+/g) ?? []).length;
  if (plusCount === 0) return true;
  return plusCount === 1 && value.startsWith("+");
};

const hasValidName = (value: string) => {
  const normalized = normalizeContactValue(value);
  if (!normalized || normalized.length > MAX_NAME_LENGTH) return false;
  if (sanitizeNameInput(normalized) !== normalized) return false;
  return getNameLetterCount(normalized) >= MIN_NAME_LETTERS;
};

const hasValidPhone = (value: string) => {
  const normalized = normalizeContactValue(value);
  if (!normalized || normalized.length > MAX_PHONE_LENGTH) return false;
  if (!hasPhonePlusInValidPosition(normalized)) return false;
  if (sanitizePhoneInput(normalized) !== normalized) return false;
  const digitsCount = getPhoneDigitsCount(normalized);
  return digitsCount >= MIN_PHONE_DIGITS && digitsCount <= MAX_PHONE_DIGITS;
};

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
  extraBackgrounds,
  maxExtraSelections,
  basePrice,
  policies,
  profileName,
  profilePhone,
  isContactVerified,
}: BookingFormProps) {
  const router = useRouter();
  const [name, setName] = useState(sanitizeNameInput(profileName));
  const [phone, setPhone] = useState(sanitizePhoneInput(profilePhone));
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [selectedExtraModes, setSelectedExtraModes] = useState<
    Record<string, ExtraMode>
  >({});
  const [extrasError, setExtrasError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [apiError, setApiError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  const normalizedExtraBackgrounds = useMemo(
    () => extraBackgrounds.slice(0, 5),
    [extraBackgrounds]
  );
  const safeMaxExtraSelections = useMemo(
    () => resolveExtraMaxSelections(maxExtraSelections),
    [maxExtraSelections]
  );

  const selectedExtras = useMemo(
    () =>
      normalizedExtraBackgrounds.flatMap((background) => {
        const mode = selectedExtraModes[background.id];
        if (!mode) return [];
        const price =
          mode === "pisando" ? background.pricePisando : background.priceSinPisar;
        return [
          {
            backgroundId: background.id,
            color: background.color,
            mode,
            price,
            label: buildExtraSelectionLabel(background.color, mode),
          },
        ];
      }),
    [normalizedExtraBackgrounds, selectedExtraModes]
  );

  const extrasTotal = useMemo(
    () => selectedExtras.reduce((total, extra) => total + extra.price, 0),
    [selectedExtras]
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
      title: String(list.length),
      start: dateKey,
      allDay: true,
      extendedProps: {
        ariaLabel:
          list.length === 1
            ? "1 horario disponible"
            : `${list.length} horarios disponibles`,
      },
    }));
  }, [groupedSlots]);

  const selectedSlots = useMemo(
    () => (selectedDate ? groupedSlots.get(selectedDate) ?? [] : []),
    [groupedSlots, selectedDate]
  );
  const selectedDateSlotIndexById = useMemo(
    () =>
      new Map(
        selectedSlots.map((slot, index) => [slot.id, index] as const)
      ),
    [selectedSlots]
  );

  const slotById = useMemo(
    () => new Map(slots.map((slot) => [slot.id, slot])),
    [slots]
  );

  const selectedSlotCount = selectedSlotIds.length;
  const normalizedName = sanitizeNameInput(name);
  const normalizedPhone = sanitizePhoneInput(phone);
  const normalizedProfileName = normalizeContactValue(profileName);
  const normalizedProfilePhone = normalizeContactValue(profilePhone);
  const canUseVerifiedContact =
    isContactVerified &&
    hasValidName(normalizedProfileName) &&
    hasValidPhone(normalizedProfilePhone);
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

  const getNameError = () => {
    if (canUseVerifiedContact) return null;
    if (!normalizedName) return "Escribe tu nombre.";

    const lettersCount = getNameLetterCount(normalizedName);
    if (lettersCount < MIN_NAME_LETTERS) {
      return `El nombre debe tener al menos ${MIN_NAME_LETTERS} letras.`;
    }

    if (normalizedName.length > MAX_NAME_LENGTH) {
      return `El nombre no puede superar ${MAX_NAME_LENGTH} caracteres.`;
    }

    return hasValidName(normalizedName)
      ? null
      : "El nombre solo puede incluir letras, espacios, apóstrofes y guiones.";
  };

  const getPhoneError = () => {
    if (canUseVerifiedContact) return null;
    if (!normalizedPhone) return "Escribe tu teléfono.";

    const digitsCount = getPhoneDigitsCount(normalizedPhone);
    if (digitsCount < MIN_PHONE_DIGITS) {
      return `El teléfono debe tener al menos ${MIN_PHONE_DIGITS} dígitos.`;
    }

    if (digitsCount > MAX_PHONE_DIGITS) {
      return `El teléfono no puede superar ${MAX_PHONE_DIGITS} dígitos.`;
    }

    return hasValidPhone(normalizedPhone)
      ? null
      : "Escribe un teléfono válido.";
  };

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

  const toggleBackgroundSelection = (backgroundId: string) => {
    setSelectedExtraModes((prev) => {
      if (prev[backgroundId]) {
        const next = { ...prev };
        delete next[backgroundId];
        setExtrasError("");
        return next;
      }

      const allowedIds = new Set(normalizedExtraBackgrounds.map((item) => item.id));
      const selectedCount = Object.keys(prev).filter((id) =>
        allowedIds.has(id)
      ).length;

      if (selectedCount >= safeMaxExtraSelections) {
        setExtrasError(
          `Podés elegir hasta ${safeMaxExtraSelections} colores de fondo.`
        );
        return prev;
      }

      setExtrasError("");
      return {
        ...prev,
        [backgroundId]: "sin_pisar",
      };
    });
  };

  const updateBackgroundMode = (backgroundId: string, mode: ExtraMode) => {
    setSelectedExtraModes((prev) => {
      if (!prev[backgroundId]) {
        return prev;
      }
      return {
        ...prev,
        [backgroundId]: mode,
      };
    });
  };

  const toggleSlotSelection = (slotId: string) => {
    let nextError = "";

    setSelectedSlotIds((prevSelectedSlotIds) => {
      const isRemoving = prevSelectedSlotIds.includes(slotId);
      const nextSlotIds = isRemoving
        ? prevSelectedSlotIds.filter((item) => item !== slotId)
        : [...prevSelectedSlotIds, slotId];
      const nextSelectedSlots = nextSlotIds
        .map((id) => slotById.get(id))
        .filter((slot): slot is SlotOption => Boolean(slot))
        .sort(sortSlotsByStart);

      if (areConsecutiveSlots(nextSelectedSlots)) {
        return nextSlotIds;
      }

      if (isRemoving) {
        const clickedIndex = selectedDateSlotIndexById.get(slotId);
        const selectedIndexes = prevSelectedSlotIds
          .map((id) => selectedDateSlotIndexById.get(id))
          .filter((index): index is number => index !== undefined);

        if (
          clickedIndex === undefined ||
          selectedIndexes.length !== prevSelectedSlotIds.length
        ) {
          nextError = "Las horas seleccionadas deben ser consecutivas.";
          return prevSelectedSlotIds;
        }

        const minIndex = Math.min(...selectedIndexes);
        const maxIndex = Math.max(...selectedIndexes);
        const isMiddleSelection = clickedIndex > minIndex && clickedIndex < maxIndex;

        if (isMiddleSelection) {
          const distanceToStart = clickedIndex - minIndex;
          const distanceToEnd = maxIndex - clickedIndex;
          const trimFromStart = distanceToStart <= distanceToEnd;
          const keptRange = trimFromStart
            ? selectedSlots.slice(clickedIndex + 1, maxIndex + 1)
            : selectedSlots.slice(minIndex, clickedIndex);
          return keptRange.map((slot) => slot.id);
        }

        nextError = "Las horas seleccionadas deben ser consecutivas.";
        return prevSelectedSlotIds;
      }

      const clickedIndex = selectedDateSlotIndexById.get(slotId);
      if (
        clickedIndex === undefined ||
        prevSelectedSlotIds.length === 0
      ) {
        nextError = "Las horas seleccionadas deben ser consecutivas.";
        return prevSelectedSlotIds;
      }

      const selectedIndexes = prevSelectedSlotIds
        .map((id) => selectedDateSlotIndexById.get(id))
        .filter((index): index is number => index !== undefined);

      if (selectedIndexes.length !== prevSelectedSlotIds.length) {
        nextError = "Las horas seleccionadas deben ser consecutivas.";
        return prevSelectedSlotIds;
      }

      const minIndex = Math.min(clickedIndex, ...selectedIndexes);
      const maxIndex = Math.max(clickedIndex, ...selectedIndexes);
      const rangeSlots = selectedSlots.slice(minIndex, maxIndex + 1);

      if (!rangeSlots.length || !areConsecutiveSlots(rangeSlots)) {
        nextError = "Las horas seleccionadas deben ser consecutivas.";
        return prevSelectedSlotIds;
      }

      return rangeSlots.map((slot) => slot.id);
    });

    setApiError(nextError);
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
      const bookingName = canUseVerifiedContact
        ? normalizedProfileName
        : normalizedName;
      const bookingPhone = canUseVerifiedContact
        ? normalizedProfilePhone
        : normalizedPhone;

      const response = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: bookingName,
          phone: bookingPhone,
          slotIds: selectedSlotIds,
          extras: selectedExtras.map((extra) => extra.label),
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
  const hasContactError = Boolean(getNameError() || getPhoneError());
  const isSubmitDisabled =
    status === "loading" ||
    slots.length === 0 ||
    selectedSlotIds.length < 2 ||
    !isSelectionConsecutive ||
    hasContactError;
  const submitDisabledReason = (() => {
    if (status === "loading") return "Procesando tu reserva...";
    if (slots.length === 0) return "Todavía no hay horarios disponibles.";
    if (selectedSlotIds.length < 2)
      return "Seleccioná al menos 2 horas consecutivas.";
    if (!isSelectionConsecutive)
      return "Las horas seleccionadas deben ser consecutivas.";
    if (hasContactError) return "Completá nombre y teléfono válidos.";
    return "";
  })();
  const openPolicyModal = () => setIsPolicyModalOpen(true);
  const closePolicyModal = () => setIsPolicyModalOpen(false);

  const inputClass = (invalid: boolean) =>
    [
      "rounded-2xl border px-4 py-3 text-sm text-fg placeholder:text-muted outline-none transition focus:border-accent",
      invalid ? "border-accent bg-accent/10" : "border-accent/20 bg-white",
    ].join(" ");

  return (
    <form
      className="booking-form mt-6 grid min-w-0 gap-4"
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

      {canUseVerifiedContact ? (
        <div className="rounded-2xl border border-accent/15 bg-bg px-4 py-3 text-xs text-muted">
          Usaremos los datos verificados de tu cuenta: {" "}
          <span className="font-semibold text-fg">{normalizedProfileName}</span> /{" "}
          <span className="font-semibold text-fg">{normalizedProfilePhone}</span>.
        </div>
      ) : (
        <>
          <label className="grid gap-2 text-sm font-semibold">
            Nombre
            <input
              className={inputClass(Boolean(nameError))}
              type="text"
              value={name}
              onChange={(event) => setName(sanitizeNameInput(event.target.value))}
              autoComplete="name"
              autoCapitalize="words"
              maxLength={MAX_NAME_LENGTH}
              required
            />
            {nameError && (
              <span className="text-xs text-accent">{nameError}</span>
            )}
          </label>

          <label className="grid gap-2 text-sm font-semibold">
            Teléfono
          <input
            className={inputClass(Boolean(phoneError))}
            type="tel"
            value={phone}
            onChange={(event) =>
              setPhone(sanitizePhoneInput(event.target.value))
            }
            autoComplete="tel"
            autoCapitalize="none"
            inputMode="tel"
            maxLength={MAX_PHONE_LENGTH}
            required
            />
            {phoneError && (
              <span className="text-xs text-accent">{phoneError}</span>
            )}
          </label>

          <p className="text-xs text-muted">
            Solo necesitamos tu nombre y teléfono la primera vez.
          </p>
        </>
      )}

      <div className="grid min-w-0 gap-3">
        <p className="text-sm font-semibold">Seleccioná un día</p>
        <p className="text-xs text-muted">
          La reserva mínima es de 2 horas consecutivas. Además, se reserva 1
          hora posterior para mantenimiento. Podés tocar la primera y la última
          hora para completar el rango automáticamente.
        </p>
        <div className="booking-calendar min-w-0 overflow-hidden rounded-2xl border border-accent/15 bg-white/80 p-2 sm:p-3">
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
              left: "prev,today,next",
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
          <div className="rounded-2xl border border-accent/15 bg-white/70 p-2 min-w-0">
            <div className="grid max-h-[44vh] grid-cols-1 gap-1.5 overflow-y-auto overscroll-contain pr-1 sm:max-h-80">
              {selectedSlots.map((slot) => {
                const label = formatRangeLabel(slot.start, slot.end);
                const isSelected = selectedSlotIds.includes(slot.id);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => toggleSlotSelection(slot.id)}
                    data-slot-selected={isSelected ? "true" : "false"}
                    className={`booking-slot-button rounded-xl border px-3 py-2 text-xs font-semibold transition sm:text-sm ${
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
          </div>
        )}
        {slotError && (
          <span className="text-xs text-accent">{slotError}</span>
        )}
      </div>

      <div className="booking-extras grid gap-2 rounded-2xl border border-accent/15 bg-white/80 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Extras
        </p>
        {normalizedExtraBackgrounds.length === 0 ? (
          <p className="text-sm text-muted">No hay extras configurados.</p>
        ) : (
          <div className="grid gap-3">
            <p className="text-xs text-muted">
              Cada color seleccionado se cobra por separado.
            </p>
            {normalizedExtraBackgrounds.map((background) => {
              const selectedMode = selectedExtraModes[background.id];
              const isSelected = Boolean(selectedMode);
              const sinPisarLabel = formatExtraPriceLabel(background.priceSinPisar);
              const pisandoLabel = formatExtraPriceLabel(background.pricePisando);

              return (
                <div
                  key={background.id}
                  className={`rounded-2xl border px-3 py-3 transition ${
                    isSelected
                      ? "border-accent bg-accent/8"
                      : "border-accent/20 bg-bg/60"
                  }`}
                >
                  <label className="flex items-center justify-between gap-3 text-sm font-semibold">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleBackgroundSelection(background.id)}
                      />
                      {background.color}
                    </span>
                    {!isSelected ? (
                      <span className="text-xs font-medium text-muted">
                        {sinPisarLabel} / {pisandoLabel}
                      </span>
                    ) : null}
                  </label>

                  {isSelected ? (
                    <div
                      className="mt-3 grid gap-2 sm:grid-cols-2"
                      role="radiogroup"
                      aria-label={`Modo de ${background.color}`}
                    >
                      <label className="flex items-center gap-2 rounded-xl border border-accent/20 bg-white/80 px-3 py-2 text-xs font-semibold">
                        <input
                          type="radio"
                          name={`background-mode-${background.id}`}
                          checked={selectedMode === "sin_pisar"}
                          onChange={() =>
                            updateBackgroundMode(background.id, "sin_pisar")
                          }
                        />
                        Sin pisar (+{sinPisarLabel})
                      </label>
                      <label className="flex items-center gap-2 rounded-xl border border-accent/20 bg-white/80 px-3 py-2 text-xs font-semibold">
                        <input
                          type="radio"
                          name={`background-mode-${background.id}`}
                          checked={selectedMode === "pisando"}
                          onChange={() =>
                            updateBackgroundMode(background.id, "pisando")
                          }
                        />
                        Pisando (+{pisandoLabel})
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        {extrasError ? (
          <span className="text-xs text-accent">{extrasError}</span>
        ) : null}
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
        {selectedExtras.length > 0 && (
          <div className="mt-1 text-xs text-muted">
            {selectedExtras.map((extra) => extra.label).join(", ")}
          </div>
        )}
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

      {isSubmitDisabled && submitDisabledReason && (
        <div
          className="mx-auto w-full max-w-md rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-center text-sm font-semibold text-accent shadow-sm"
          role="status"
          aria-live="polite"
        >
          {submitDisabledReason}
        </div>
      )}

      <button
        className="booking-submit mt-2 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 disabled:cursor-not-allowed disabled:opacity-70"
        type="submit"
        disabled={isSubmitDisabled}
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
          términos y condiciones
        </button>
        .
      </p>

      <PoliciesModal
        isOpen={isPolicyModalOpen}
        onClose={closePolicyModal}
        policies={policies}
      />
    </form>
  );
}

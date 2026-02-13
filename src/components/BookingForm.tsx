"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import PoliciesModal from "@/components/PoliciesModal";
import type { ExtraBackground, StudioContent } from "@/content/studio";
import {
  BOOKING_TIMEZONE,
  buildExtraSelectionLabel,
  calculateBookingPricing,
  formatExtraPriceLabel,
  resolveExtraMaxSelections,
  resolveExtrasFromLabels,
  type ExtraMode,
} from "@/lib/booking";
import {
  getEmptyServiceSelection,
  getServicesBreakdown,
  normalizeBookingServicesSelection,
  normalizeServiceCatalog,
  parseStoredServicesSelection,
  type BookingServicesSelection,
  type ServiceSubtotal,
} from "@/lib/services";

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
  services: StudioContent["services"];
  holidayDates?: string[];
  policies: StudioContent["footer"]["policies"];
  profileName: string;
  profilePhone: string;
  isContactVerified: boolean;
  editBookingId?: string;
  editSection?: "horario" | "extras" | "servicios" | null;
  initialSelectedSlotIds?: string[];
  initialSelectedExtras?: string[];
  initialSelectedServicesRaw?: string | null;
  pageTitle: string;
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
const CALENDAR_TOGGLE_DURATION_MS = 320;

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
const getConsecutiveRange = (
  daySlots: SlotOption[],
  startIndex: number,
  endIndex: number
) => {
  if (
    startIndex < 0 ||
    endIndex < 0 ||
    startIndex > endIndex ||
    endIndex >= daySlots.length
  ) {
    return null;
  }

  const range = daySlots.slice(startIndex, endIndex + 1);
  if (!range.length) return null;
  return areConsecutiveSlots(range) ? range : null;
};
const getOrderedIndexes = (indexes: number[]) => [...indexes].sort((a, b) => a - b);
const getInitialSlotSelection = (
  slots: SlotOption[],
  initialSlotIds: string[]
) => {
  const slotById = new Map(slots.map((slot) => [slot.id, slot] as const));
  const selectedSlotIds = Array.from(
    new Set(initialSlotIds.map((slotId) => slotId.trim()).filter(Boolean))
  )
    .filter((slotId) => slotById.has(slotId))
    .sort((slotIdA, slotIdB) => {
      const slotA = slotById.get(slotIdA);
      const slotB = slotById.get(slotIdB);
      if (!slotA || !slotB) return 0;
      return sortSlotsByStart(slotA, slotB);
    });

  const firstSlot = selectedSlotIds.length
    ? slotById.get(selectedSlotIds[0])
    : null;

  return {
    selectedSlotIds,
    selectedDate: firstSlot ? getDateKey(firstSlot.start) : null,
  };
};

const getInitialExtraModes = (
  initialExtras: string[],
  extraBackgrounds: ExtraBackground[],
  maxExtraSelections: number
) => {
  const resolvedExtras = resolveExtrasFromLabels(
    initialExtras,
    extraBackgrounds.slice(0, 5),
    resolveExtraMaxSelections(maxExtraSelections)
  );

  return Object.fromEntries(
    resolvedExtras.map((extra) => [extra.backgroundId, extra.mode])
  ) as Record<string, ExtraMode>;
};

export default function BookingForm({
  slots,
  extraBackgrounds,
  maxExtraSelections,
  basePrice,
  services,
  holidayDates = [],
  policies,
  profileName,
  profilePhone,
  isContactVerified,
  editBookingId,
  editSection,
  initialSelectedSlotIds = [],
  initialSelectedExtras = [],
  initialSelectedServicesRaw,
  pageTitle,
}: BookingFormProps) {
  const router = useRouter();
  const scheduleSectionRef = useRef<HTMLDivElement>(null);
  const initialSlotSelection = getInitialSlotSelection(slots, initialSelectedSlotIds);
  const initialExtraModes = getInitialExtraModes(
    initialSelectedExtras,
    extraBackgrounds,
    maxExtraSelections
  );
  const normalizedServicesCatalog = normalizeServiceCatalog(services);
  const initialServicesSelection = initialSelectedServicesRaw
    ? parseStoredServicesSelection(initialSelectedServicesRaw, normalizedServicesCatalog)
    : getEmptyServiceSelection();
  const shouldOpenScheduleByDefault =
    Boolean(editBookingId) && editSection === "horario";
  const shouldOpenExtrasByDefault =
    Boolean(editBookingId) && editSection === "extras";
  const shouldOpenServicesByDefault =
    Boolean(editBookingId) && editSection === "servicios";
  const [name, setName] = useState(sanitizeNameInput(profileName));
  const [phone, setPhone] = useState(sanitizePhoneInput(profilePhone));
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>(
    initialSlotSelection.selectedSlotIds
  );
  const [selectedExtraModes, setSelectedExtraModes] =
    useState<Record<string, ExtraMode>>(initialExtraModes);
  const [selectedServices, setSelectedServices] =
    useState<BookingServicesSelection>(initialServicesSelection);
  const [extrasError, setExtrasError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [apiError, setApiError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(
    initialSlotSelection.selectedDate
  );
  const [showCalendar, setShowCalendar] = useState(shouldOpenScheduleByDefault);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(
    shouldOpenScheduleByDefault
  );
  const [showSlotsPanel, setShowSlotsPanel] = useState(shouldOpenScheduleByDefault);
  const [isSlotsExpanded, setIsSlotsExpanded] = useState(
    shouldOpenScheduleByDefault
  );
  const [showExtrasPanel, setShowExtrasPanel] = useState(shouldOpenExtrasByDefault);
  const [isExtrasExpanded, setIsExtrasExpanded] = useState(
    shouldOpenExtrasByDefault
  );
  const [showServicesPanel, setShowServicesPanel] = useState(
    shouldOpenServicesByDefault
  );
  const [isServicesExpanded, setIsServicesExpanded] = useState(
    shouldOpenServicesByDefault
  );
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const calendarToggleTimerRef = useRef<number | null>(null);
  const slotsToggleTimerRef = useRef<number | null>(null);
  const extrasToggleTimerRef = useRef<number | null>(null);
  const servicesToggleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isGuideModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isGuideModalOpen]);

  useEffect(() => {
    if (!isGuideModalOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsGuideModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isGuideModalOpen]);

  useEffect(() => {
    return () => {
      if (calendarToggleTimerRef.current !== null) {
        window.clearTimeout(calendarToggleTimerRef.current);
      }
      if (slotsToggleTimerRef.current !== null) {
        window.clearTimeout(slotsToggleTimerRef.current);
      }
      if (extrasToggleTimerRef.current !== null) {
        window.clearTimeout(extrasToggleTimerRef.current);
      }
      if (servicesToggleTimerRef.current !== null) {
        window.clearTimeout(servicesToggleTimerRef.current);
      }
    };
  }, []);

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
  const servicesBreakdown = useMemo(
    () =>
      getServicesBreakdown({
        selection: selectedServices,
        catalog: normalizedServicesCatalog,
        hours: selectedSlotIds.length,
      }),
    [normalizedServicesCatalog, selectedServices, selectedSlotIds.length]
  );
  const servicesTotal = servicesBreakdown.total;
  const servicesSubtotalsByKey = useMemo(
    () =>
      new Map<ServiceSubtotal["key"], ServiceSubtotal>(
        servicesBreakdown.subtotals.map((item) => [item.key, item] as const)
      ),
    [servicesBreakdown.subtotals]
  );
  const photographySubtotal = servicesSubtotalsByKey.get("photography");
  const modelsSubtotal = servicesSubtotalsByKey.get("models");
  const makeupSubtotal = servicesSubtotalsByKey.get("makeup");
  const hairstyleSubtotal = servicesSubtotalsByKey.get("hairstyle");
  const stylingSubtotal = servicesSubtotalsByKey.get("styling");
  const artDirectionSubtotal = servicesSubtotalsByKey.get("art_direction");
  const lightOperatorSubtotal = servicesSubtotalsByKey.get("light_operator");
  const assistantsSubtotal = servicesSubtotalsByKey.get("assistants");
  const selectedPhotographyOption = useMemo(
    () =>
      normalizedServicesCatalog.photographyOptions.find(
        (option) => option.id === selectedServices.photographyOptionId
      ) || null,
    [normalizedServicesCatalog.photographyOptions, selectedServices.photographyOptionId]
  );
  const selectedMakeupOption = useMemo(
    () =>
      normalizedServicesCatalog.makeupOptions.find(
        (option) => option.id === selectedServices.makeupOptionId
      ) || null,
    [normalizedServicesCatalog.makeupOptions, selectedServices.makeupOptionId]
  );

  const selectedSlotRanges = useMemo(
    () =>
      selectedSlotIds
        .map((selectedSlotId) => slots.find((slot) => slot.id === selectedSlotId))
        .filter((slot): slot is SlotOption => Boolean(slot))
        .sort(sortSlotsByStart)
        .map((slot) => ({
          start: toDate(slot.start),
          end: toDate(slot.end),
        })),
    [selectedSlotIds, slots]
  );
  const selectedSlotCount = selectedSlotIds.length;

  const pricingSummary = useMemo(
    () =>
      calculateBookingPricing({
        basePrice,
        extrasTotal,
        servicesTotal,
        slots: selectedSlotRanges,
        holidayDates,
        fallbackHours: selectedSlotCount,
      }),
    [
      basePrice,
      extrasTotal,
      servicesTotal,
      holidayDates,
      selectedSlotCount,
      selectedSlotRanges,
    ]
  );
  const total = pricingSummary.grandTotal;
  const hoursBreakdownLabel =
    selectedSlotCount > 0
      ? `${selectedSlotCount} ${selectedSlotCount === 1 ? "hora" : "horas"} x $${basePrice.toLocaleString("es-AR")}`
      : "Selecciona minimo 2 horas consecutivas.";
  const surchargesBreakdownLabel = useMemo(() => {
    const parts: string[] = [];
    if (pricingSummary.weekendOrHolidaySurcharge > 0) {
      parts.push(
        `finde/feriado $${pricingSummary.weekendOrHolidaySurcharge.toLocaleString("es-AR")}`
      );
    }
    if (pricingSummary.nightSurcharge > 0) {
      parts.push(`nocturno $${pricingSummary.nightSurcharge.toLocaleString("es-AR")}`);
    }
    return parts.join(" + ");
  }, [pricingSummary.nightSurcharge, pricingSummary.weekendOrHolidaySurcharge]);

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

  useEffect(() => {
    if (!editBookingId) {
      return;
    }

    window.requestAnimationFrame(() => {
      scheduleSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [
    editBookingId,
  ]);

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

  const getServicesError = () => {
    if (servicesBreakdown.errors.length) {
      return servicesBreakdown.errors[0];
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

  const setModelsCount = (value: number) => {
    const maxModels = normalizedServicesCatalog.maxModels;
    setSelectedServices((prev) => {
      const nextModels = Math.max(0, Math.min(maxModels, value));
      if (nextModels === 0) {
        return {
          ...prev,
          modelsCount: 0,
          makeupOptionId: null,
          hairstyleEnabled: false,
        };
      }
      return {
        ...prev,
        modelsCount: nextModels,
      };
    });
  };

  const setAssistantsCount = (value: number) => {
    const maxAssistants = normalizedServicesCatalog.maxAssistants;
    setSelectedServices((prev) => ({
      ...prev,
      assistantsCount: Math.max(0, Math.min(maxAssistants, value)),
    }));
  };

  const setPhotographyOption = (optionId: string | null) => {
    setSelectedServices((prev) => ({
      ...prev,
      photographyOptionId: optionId,
    }));
  };

  const setMakeupOption = (optionId: string | null) => {
    setSelectedServices((prev) => ({
      ...prev,
      makeupOptionId: optionId,
    }));
  };

  const setStylingOption = (optionId: string | null) => {
    setSelectedServices((prev) => ({
      ...prev,
      stylingOptionId: optionId,
    }));
  };

  const setArtDirectionOption = (optionId: string | null) => {
    setSelectedServices((prev) => ({
      ...prev,
      artDirectionOptionId: optionId,
    }));
  };

  const setHairStyleEnabled = (enabled: boolean) => {
    setSelectedServices((prev) => ({
      ...prev,
      hairstyleEnabled: enabled,
    }));
  };

  const setLightOperatorEnabled = (enabled: boolean) => {
    setSelectedServices((prev) => ({
      ...prev,
      lightOperatorEnabled: enabled,
    }));
  };

  const toggleSlotSelection = (slotId: string) => {
    let nextError = "";

    setSelectedSlotIds((prevSelectedSlotIds) => {
      const clickedIndex = selectedDateSlotIndexById.get(slotId);
      if (clickedIndex === undefined) {
        nextError = "No pudimos identificar ese horario. Proba de nuevo.";
        return prevSelectedSlotIds;
      }

      const selectedIndexes = getOrderedIndexes(
        prevSelectedSlotIds
        .map((id) => selectedDateSlotIndexById.get(id))
        .filter((index): index is number => index !== undefined)
      );

      if (selectedIndexes.length !== prevSelectedSlotIds.length) {
        nextError = "Actualizamos los horarios. Seleccionalos de nuevo.";
        return [];
      }

      if (selectedIndexes.length === 0) {
        const pairWithNext = getConsecutiveRange(
          selectedSlots,
          clickedIndex,
          clickedIndex + 1
        );
        if (pairWithNext) {
          return pairWithNext.map((slot) => slot.id);
        }

        const pairWithPrevious = getConsecutiveRange(
          selectedSlots,
          clickedIndex - 1,
          clickedIndex
        );
        if (pairWithPrevious) {
          return pairWithPrevious.map((slot) => slot.id);
        }

        nextError = "Elegi una hora que tenga otra consecutiva disponible.";
        return prevSelectedSlotIds;
      }

      const minIndex = selectedIndexes[0];
      const maxIndex = selectedIndexes[selectedIndexes.length - 1];
      const isRemoving = selectedIndexes.includes(clickedIndex);

      if (isRemoving) {
        if (selectedIndexes.length <= 2) {
          return [];
        }

        if (clickedIndex === minIndex) {
          const nextRange = getConsecutiveRange(
            selectedSlots,
            minIndex + 1,
            maxIndex
          );
          if (nextRange && nextRange.length >= 2) {
            return nextRange.map((slot) => slot.id);
          }
          nextError = "Las horas seleccionadas deben ser consecutivas.";
          return prevSelectedSlotIds;
        }

        if (clickedIndex === maxIndex) {
          const nextRange = getConsecutiveRange(
            selectedSlots,
            minIndex,
            maxIndex - 1
          );
          if (nextRange && nextRange.length >= 2) {
            return nextRange.map((slot) => slot.id);
          }
          nextError = "Las horas seleccionadas deben ser consecutivas.";
          return prevSelectedSlotIds;
        }

        const distanceToStart = clickedIndex - minIndex;
        const distanceToEnd = maxIndex - clickedIndex;
        const trimFromStart = distanceToStart <= distanceToEnd;
        const nextStart = trimFromStart ? clickedIndex + 1 : minIndex;
        const nextEnd = trimFromStart ? maxIndex : clickedIndex - 1;
        const nextRange = getConsecutiveRange(selectedSlots, nextStart, nextEnd);

        if (nextRange && nextRange.length >= 2) {
          return nextRange.map((slot) => slot.id);
        }

        nextError = "El minimo para reservar es 2 horas consecutivas.";
        return prevSelectedSlotIds;
      }

      const nextMin = Math.min(minIndex, clickedIndex);
      const nextMax = Math.max(maxIndex, clickedIndex);
      const nextRange = getConsecutiveRange(selectedSlots, nextMin, nextMax);
      if (!nextRange) {
        nextError = "Las horas seleccionadas deben ser consecutivas.";
        return prevSelectedSlotIds;
      }

      return nextRange.map((slot) => slot.id);
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
      getServicesError(),
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

      const endpoint = editBookingId
        ? `/api/booking/${encodeURIComponent(editBookingId)}`
        : "/api/booking";
      const method = editBookingId ? "PATCH" : "POST";
      const requestPayload = editBookingId
        ? {
            slotIds: selectedSlotIds,
            extras: selectedExtras.map((extra) => extra.label),
            services: normalizeBookingServicesSelection(
              selectedServices,
              normalizedServicesCatalog
            ),
          }
        : {
            name: bookingName,
            phone: bookingPhone,
            slotIds: selectedSlotIds,
            extras: selectedExtras.map((extra) => extra.label),
            services: normalizeBookingServicesSelection(
              selectedServices,
              normalizedServicesCatalog
            ),
          };

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestPayload),
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
  const servicesValidationError = getServicesError();
  const servicesError = attempted ? servicesValidationError : null;
  const hasContactError = Boolean(getNameError() || getPhoneError());
  const hasServicesValidationError = Boolean(getServicesError());
  const isSubmitDisabled =
    status === "loading" ||
    slots.length === 0 ||
    selectedSlotIds.length < 2 ||
    !isSelectionConsecutive ||
    hasContactError ||
    hasServicesValidationError;
  const submitDisabledReason = (() => {
    if (status === "loading") return "Procesando tu reserva...";
    if (slots.length === 0) return "Todavía no hay horarios disponibles.";
    if (selectedSlotIds.length < 2)
      return "Seleccioná al menos 2 horas consecutivas.";
    if (!isSelectionConsecutive)
      return "Las horas seleccionadas deben ser consecutivas.";
    if (hasContactError) return "Completá nombre y teléfono válidos.";
    if (servicesValidationError) return servicesValidationError;
    return "";
  })();
  const canConfirmSchedule =
    Boolean(selectedDate) &&
    selectedSlotIds.length >= 2 &&
    isSelectionConsecutive;
  const openCalendar = () => {
    if (showCalendar && isCalendarExpanded) {
      return;
    }

    if (calendarToggleTimerRef.current !== null) {
      window.clearTimeout(calendarToggleTimerRef.current);
      calendarToggleTimerRef.current = null;
    }

    setShowCalendar(true);
    window.requestAnimationFrame(() => {
      setIsCalendarExpanded(true);
    });
  };
  const closeCalendar = () => {
    if (!showCalendar) {
      return;
    }

    if (calendarToggleTimerRef.current !== null) {
      window.clearTimeout(calendarToggleTimerRef.current);
      calendarToggleTimerRef.current = null;
    }

    setIsCalendarExpanded(false);
    calendarToggleTimerRef.current = window.setTimeout(() => {
      setShowCalendar(false);
      calendarToggleTimerRef.current = null;
    }, CALENDAR_TOGGLE_DURATION_MS);
  };
  const toggleCalendar = () => {
    if (showCalendar && isCalendarExpanded) {
      closeCalendar();
      return;
    }
    openCalendar();
  };
  const openSlotsPanel = () => {
    if (showSlotsPanel && isSlotsExpanded) {
      return;
    }

    if (slotsToggleTimerRef.current !== null) {
      window.clearTimeout(slotsToggleTimerRef.current);
      slotsToggleTimerRef.current = null;
    }

    setShowSlotsPanel(true);
    window.requestAnimationFrame(() => {
      setIsSlotsExpanded(true);
    });
  };
  const closeSlotsPanel = () => {
    if (!showSlotsPanel) {
      return;
    }

    if (slotsToggleTimerRef.current !== null) {
      window.clearTimeout(slotsToggleTimerRef.current);
      slotsToggleTimerRef.current = null;
    }

    setIsSlotsExpanded(false);
    slotsToggleTimerRef.current = window.setTimeout(() => {
      setShowSlotsPanel(false);
      slotsToggleTimerRef.current = null;
    }, CALENDAR_TOGGLE_DURATION_MS);
  };
  const toggleSlotsPanel = () => {
    if (showSlotsPanel && isSlotsExpanded) {
      closeSlotsPanel();
      return;
    }
    openSlotsPanel();
  };
  const openExtrasPanel = () => {
    if (showExtrasPanel && isExtrasExpanded) {
      return;
    }

    if (extrasToggleTimerRef.current !== null) {
      window.clearTimeout(extrasToggleTimerRef.current);
      extrasToggleTimerRef.current = null;
    }

    setShowExtrasPanel(true);
    window.requestAnimationFrame(() => {
      setIsExtrasExpanded(true);
    });
  };
  const closeExtrasPanel = () => {
    if (!showExtrasPanel) {
      return;
    }

    if (extrasToggleTimerRef.current !== null) {
      window.clearTimeout(extrasToggleTimerRef.current);
      extrasToggleTimerRef.current = null;
    }

    setIsExtrasExpanded(false);
    extrasToggleTimerRef.current = window.setTimeout(() => {
      setShowExtrasPanel(false);
      extrasToggleTimerRef.current = null;
    }, CALENDAR_TOGGLE_DURATION_MS);
  };
  const toggleExtrasPanel = () => {
    if (showExtrasPanel && isExtrasExpanded) {
      closeExtrasPanel();
      return;
    }
    openExtrasPanel();
  };
  const openServicesPanel = () => {
    if (showServicesPanel && isServicesExpanded) {
      return;
    }

    if (servicesToggleTimerRef.current !== null) {
      window.clearTimeout(servicesToggleTimerRef.current);
      servicesToggleTimerRef.current = null;
    }

    setShowServicesPanel(true);
    window.requestAnimationFrame(() => {
      setIsServicesExpanded(true);
    });
  };
  const closeServicesPanel = () => {
    if (!showServicesPanel) {
      return;
    }

    if (servicesToggleTimerRef.current !== null) {
      window.clearTimeout(servicesToggleTimerRef.current);
      servicesToggleTimerRef.current = null;
    }

    setIsServicesExpanded(false);
    servicesToggleTimerRef.current = window.setTimeout(() => {
      setShowServicesPanel(false);
      servicesToggleTimerRef.current = null;
    }, CALENDAR_TOGGLE_DURATION_MS);
  };
  const toggleServicesPanel = () => {
    if (showServicesPanel && isServicesExpanded) {
      closeServicesPanel();
      return;
    }
    openServicesPanel();
  };
  const handleDateSelection = (dateKey: string) => {
    setSelectedDate(dateKey);
    setSelectedSlotIds([]);
    setApiError("");
    closeCalendar();
    openSlotsPanel();
  };
  const handleConfirmSchedule = () => {
    if (!canConfirmSchedule) {
      return;
    }

    closeSlotsPanel();
    openServicesPanel();
  };
  const handleConfirmServices = () => {
    closeServicesPanel();
    openExtrasPanel();
  };
  const openGuideModal = () => setIsGuideModalOpen(true);
  const closeGuideModal = () => setIsGuideModalOpen(false);
  const openPolicyModal = () => setIsPolicyModalOpen(true);
  const closePolicyModal = () => setIsPolicyModalOpen(false);

  const inputClass = (invalid: boolean) =>
    [
      "rounded-2xl border px-4 py-3 text-sm text-fg placeholder:text-muted outline-none transition focus:border-accent",
      invalid ? "border-accent bg-accent/10" : "border-accent/20 bg-white",
    ].join(" ");
  const sectionToggleButtonClass =
    "group inline-flex min-h-14 w-full items-center justify-between rounded-2xl border border-accent/15 bg-white/80 px-4 py-3 text-left transition hover:border-accent/35 hover:bg-white";
  const sectionContentTransitionClass = (
    isExpanded: boolean,
    expandedMaxHeightClass = "max-h-[90rem]"
  ) =>
    `overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${
      isExpanded
        ? `pointer-events-auto ${expandedMaxHeightClass} translate-y-0 opacity-100`
        : "pointer-events-none max-h-0 -translate-y-1 opacity-0"
    }`;
  const renderSectionEditIcon = () => (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent/25 bg-bg/80 text-accent transition group-hover:border-accent/45 group-hover:bg-accent/10">
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    </span>
  );

  return (
    <form
      className="booking-form mt-6 grid min-w-0 gap-4"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-[0.2em]">
          {pageTitle}
        </h1>
        <button
          type="button"
          onClick={openGuideModal}
          aria-label="Ver instructivo de reserva"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent/25 bg-bg text-sm font-semibold text-accent transition hover:border-accent/45 hover:bg-accent/10"
        >
          ?
        </button>
      </div>
      {!canUseVerifiedContact && (
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

        </>
      )}

      <div
        id="booking-horario"
        ref={scheduleSectionRef}
        className="grid min-w-0 gap-4"
      >
        <button
          type="button"
          onClick={toggleCalendar}
          className={sectionToggleButtonClass}
          aria-label="Mostrar u ocultar calendario"
          aria-expanded={isCalendarExpanded}
          aria-controls="booking-calendar-panel"
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-fg">
            Fecha
          </span>
          {renderSectionEditIcon()}
        </button>

        {showCalendar ? (
          <div
            id="booking-calendar-panel"
            className={sectionContentTransitionClass(isCalendarExpanded)}
          >
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
                  handleDateSelection(getDateKey(info.dateStr));
                }}
                eventClick={(info) => {
                  handleDateSelection(info.event.id);
                }}
                headerToolbar={{
                  left: "prev,today,next",
                  center: "title",
                  right: "",
                }}
                height="auto"
              />
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={toggleSlotsPanel}
          className={sectionToggleButtonClass}
          aria-label="Editar horarios"
          aria-expanded={isSlotsExpanded}
          aria-controls="booking-slots-panel"
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-fg">
            Horarios
          </span>
          {renderSectionEditIcon()}
        </button>

        {showSlotsPanel ? (
          <div
            id="booking-slots-panel"
            className={sectionContentTransitionClass(isSlotsExpanded)}
          >
            <div className="grid min-w-0 gap-3">
            {!selectedDate && (
              <div className="booking-note rounded-2xl border border-accent/15 bg-bg px-4 py-3 text-sm text-muted">
                Selecciona una fecha para ver los horarios disponibles.
              </div>
            )}
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
              <button
                type="button"
                onClick={handleConfirmSchedule}
                disabled={!canConfirmSchedule}
                className="inline-flex w-full items-center justify-center rounded-full border border-accent/55 bg-accent/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-accent transition-all duration-200 hover:-translate-y-0.5 hover:border-accent2 hover:bg-accent2 hover:text-bg hover:shadow-[0_14px_28px_-18px_rgba(0,0,0,0.75)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 active:translate-y-0 disabled:cursor-not-allowed disabled:border-accent/20 disabled:bg-bg/70 disabled:text-muted disabled:shadow-none"
              >
                Confirmar horario
              </button>
            </div>
          </div>
        ) : null}
        {slotError && !showSlotsPanel ? (
          <span className="text-xs text-accent">{slotError}</span>
        ) : null}
      </div>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={toggleServicesPanel}
          className={sectionToggleButtonClass}
          aria-label="Editar servicios"
          aria-expanded={isServicesExpanded}
          aria-controls="booking-services-panel"
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-fg">
            Servicios
          </span>
          {renderSectionEditIcon()}
        </button>

        {showServicesPanel ? (
          <div
            id="booking-services-panel"
            className={sectionContentTransitionClass(
              isServicesExpanded,
              "max-h-[220rem]"
            )}
          >
            <div className="booking-services-panel grid gap-3 rounded-2xl border border-accent/15 bg-white/80 px-4 py-4">
              <div className="booking-services-section rounded-2xl border border-accent/15 bg-bg/70 p-3 text-sm text-fg">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  {normalizedServicesCatalog.title}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                  {normalizedServicesCatalog.bookingNotice}
                </p>
              </div>

              <details className="booking-services-section group rounded-2xl border border-accent/20 bg-bg/65 p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      {normalizedServicesCatalog.photographyTitle}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {photographySubtotal?.description || "Sin fotografia"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pl-3">
                    <span className="text-xs font-semibold text-fg/85">
                      {selectedPhotographyOption
                        ? formatExtraPriceLabel(selectedPhotographyOption.price)
                        : "Opcional"}
                    </span>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent/25 text-accent transition-transform group-open:rotate-180">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                  </div>
                </summary>
                <div className="mt-3">
                  <p className="text-sm text-muted">
                    {normalizedServicesCatalog.description}
                  </p>
                  {normalizedServicesCatalog.photographyHint ? (
                    <p className="mt-1 text-xs text-muted">
                      {normalizedServicesCatalog.photographyHint}
                    </p>
                  ) : null}
                  <div className="mt-2 grid gap-2">
                    <label
                      data-selected={selectedServices.photographyOptionId ? "false" : "true"}
                      className={`booking-services-photography-option flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm font-semibold ${
                        selectedServices.photographyOptionId
                          ? "border-accent/20 bg-white text-fg"
                          : "border-accent bg-accent/10 text-accent"
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="service-photography-option"
                          checked={!selectedServices.photographyOptionId}
                          onChange={() => setPhotographyOption(null)}
                        />
                        <span>Sin servicio de fotografia</span>
                      </span>
                      <span className="booking-services-photography-option-price text-xs font-medium text-muted">
                        Opcional
                      </span>
                    </label>
                    {normalizedServicesCatalog.photographyOptions.map((option) => {
                      const isSelected =
                        selectedServices.photographyOptionId === option.id;
                      return (
                        <label
                          key={option.id}
                          data-selected={isSelected ? "true" : "false"}
                          className={`booking-services-photography-option flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm font-semibold ${
                            isSelected
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-accent/20 bg-white text-fg"
                          }`}
                        >
                          <span className="flex items-start gap-2">
                            <input
                              type="radio"
                              name="service-photography-option"
                              checked={isSelected}
                              onChange={() => setPhotographyOption(option.id)}
                            />
                            <span>{option.label}</span>
                          </span>
                          <span className="booking-services-photography-option-price text-xs font-medium text-muted">
                            {formatExtraPriceLabel(option.price)} / min{" "}
                            {option.minHours || 1} h
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </details>

              <div className="grid gap-3 md:grid-cols-2">
                <details className="booking-services-section group rounded-2xl border border-accent/20 bg-bg/65 p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                        {normalizedServicesCatalog.modelsTitle}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {modelsSubtotal?.description || "Sin modelos"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pl-3">
                      <span className="text-xs font-semibold text-fg/85">
                        {formatExtraPriceLabel(modelsSubtotal?.amount ?? 0)}
                      </span>
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent/25 text-accent transition-transform group-open:rotate-180">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </span>
                    </div>
                  </summary>
                  <div className="mt-3">
                    <p className="text-xs text-muted">
                      {normalizedServicesCatalog.modelsHint}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModelsCount(selectedServices.modelsCount - 1)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent/30 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent/10"
                      >
                        -
                      </button>
                      <span className="min-w-10 text-center text-sm font-semibold text-fg">
                        {selectedServices.modelsCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => setModelsCount(selectedServices.modelsCount + 1)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent/30 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent/10"
                      >
                        +
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Tarifa:{" "}
                      {formatExtraPriceLabel(normalizedServicesCatalog.modelRatePerHour)}{" "}
                      x hora x modelo
                    </p>
                  </div>
                </details>

                <details className="booking-services-section group rounded-2xl border border-accent/20 bg-bg/65 p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                        {normalizedServicesCatalog.makeupTitle}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {makeupSubtotal?.description || "Sin maquillaje"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pl-3">
                      <span className="text-xs font-semibold text-fg/85">
                        {formatExtraPriceLabel(makeupSubtotal?.amount ?? 0)}
                      </span>
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent/25 text-accent transition-transform group-open:rotate-180">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </span>
                    </div>
                  </summary>
                  <div className="mt-3">
                    <p className="text-xs text-muted">
                      {normalizedServicesCatalog.makeupHint}
                    </p>
                    <div className="mt-2 grid gap-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-fg">
                        <input
                          type="radio"
                          name="service-makeup-option"
                          checked={!selectedServices.makeupOptionId}
                          onChange={() => setMakeupOption(null)}
                        />
                        Sin maquillaje
                      </label>
                      {normalizedServicesCatalog.makeupOptions.map((option) => (
                        <label
                          key={option.id}
                          className="flex items-center justify-between gap-2 text-xs font-semibold text-fg"
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="service-makeup-option"
                              checked={selectedServices.makeupOptionId === option.id}
                              onChange={() => setMakeupOption(option.id)}
                              disabled={selectedServices.modelsCount === 0}
                            />
                            {option.label}
                          </span>
                          <span className="text-muted">
                            {formatExtraPriceLabel(option.price)} / modelo
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </details>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <details className="booking-services-section group rounded-2xl border border-accent/20 bg-bg/65 p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                        {normalizedServicesCatalog.hairstyleTitle}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {hairstyleSubtotal?.description || "Sin peinado"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pl-3">
                      <span className="text-xs font-semibold text-fg/85">
                        {formatExtraPriceLabel(hairstyleSubtotal?.amount ?? 0)}
                      </span>
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent/25 text-accent transition-transform group-open:rotate-180">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </span>
                    </div>
                  </summary>
                  <div className="mt-3">
                    <p className="text-xs text-muted">
                      {normalizedServicesCatalog.hairstyleHint}
                    </p>
                    <label className="mt-2 flex items-center justify-between gap-2 text-xs font-semibold text-fg">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedServices.hairstyleEnabled}
                          onChange={(event) => setHairStyleEnabled(event.target.checked)}
                          disabled={selectedServices.modelsCount === 0}
                        />
                        {normalizedServicesCatalog.hairstyleLabel}
                      </span>
                      <span className="text-muted">
                        {formatExtraPriceLabel(
                          normalizedServicesCatalog.hairstyleRatePerModel
                        )}{" "}
                        / modelo
                      </span>
                    </label>
                  </div>
                </details>

                <details className="booking-services-section group rounded-2xl border border-accent/20 bg-bg/65 p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                        {normalizedServicesCatalog.lightOperatorTitle}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {lightOperatorSubtotal?.description || "Sin operador de luces"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pl-3">
                      <span className="text-xs font-semibold text-fg/85">
                        {formatExtraPriceLabel(lightOperatorSubtotal?.amount ?? 0)}
                      </span>
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent/25 text-accent transition-transform group-open:rotate-180">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </span>
                    </div>
                  </summary>
                  <div className="mt-3">
                    <p className="text-xs text-muted">
                      {normalizedServicesCatalog.lightOperatorHint}
                    </p>
                    <label className="mt-2 flex items-center justify-between gap-2 text-xs font-semibold text-fg">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedServices.lightOperatorEnabled}
                          onChange={(event) =>
                            setLightOperatorEnabled(event.target.checked)
                          }
                        />
                        {normalizedServicesCatalog.lightOperatorLabel}
                      </span>
                      <span className="text-muted">
                        {formatExtraPriceLabel(
                          normalizedServicesCatalog.lightOperatorRatePerHour
                        )}{" "}
                        / hora
                      </span>
                    </label>
                  </div>
                </details>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <details className="booking-services-section group rounded-2xl border border-accent/20 bg-bg/65 p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                        {normalizedServicesCatalog.stylingTitle}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {stylingSubtotal?.description || "Sin estilismo"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pl-3">
                      <span className="text-xs font-semibold text-fg/85">
                        {formatExtraPriceLabel(stylingSubtotal?.amount ?? 0)}
                      </span>
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent/25 text-accent transition-transform group-open:rotate-180">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </span>
                    </div>
                  </summary>
                  <div className="mt-3">
                    {normalizedServicesCatalog.stylingHint ? (
                      <p className="text-xs text-muted">
                        {normalizedServicesCatalog.stylingHint}
                      </p>
                    ) : null}
                    <div className="mt-2 grid gap-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-fg">
                        <input
                          type="radio"
                          name="service-styling-option"
                          checked={!selectedServices.stylingOptionId}
                          onChange={() => setStylingOption(null)}
                        />
                        Sin estilismo
                      </label>
                      {normalizedServicesCatalog.stylingOptions.map((option) => (
                        <label
                          key={option.id}
                          className="flex items-center justify-between gap-2 text-xs font-semibold text-fg"
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="service-styling-option"
                              checked={selectedServices.stylingOptionId === option.id}
                              onChange={() => setStylingOption(option.id)}
                            />
                            {option.label}
                          </span>
                          <span className="text-muted">
                            {formatExtraPriceLabel(option.price)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </details>

                <details className="booking-services-section group rounded-2xl border border-accent/20 bg-bg/65 p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                        {normalizedServicesCatalog.artDirectionTitle}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {artDirectionSubtotal?.description || "Sin direccion de arte"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pl-3">
                      <span className="text-xs font-semibold text-fg/85">
                        {formatExtraPriceLabel(artDirectionSubtotal?.amount ?? 0)}
                      </span>
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent/25 text-accent transition-transform group-open:rotate-180">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </span>
                    </div>
                  </summary>
                  <div className="mt-3">
                    {normalizedServicesCatalog.artDirectionHint ? (
                      <p className="text-xs text-muted">
                        {normalizedServicesCatalog.artDirectionHint}
                      </p>
                    ) : null}
                    <div className="mt-2 grid gap-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-fg">
                        <input
                          type="radio"
                          name="service-art-direction-option"
                          checked={!selectedServices.artDirectionOptionId}
                          onChange={() => setArtDirectionOption(null)}
                        />
                        Sin direccion de arte
                      </label>
                      {normalizedServicesCatalog.artDirectionOptions.map((option) => (
                        <label
                          key={option.id}
                          className="flex items-center justify-between gap-2 text-xs font-semibold text-fg"
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="service-art-direction-option"
                              checked={
                                selectedServices.artDirectionOptionId === option.id
                              }
                              onChange={() => setArtDirectionOption(option.id)}
                            />
                            {option.label}
                          </span>
                          <span className="text-muted">
                            {formatExtraPriceLabel(option.price)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </details>
              </div>

              <details className="booking-services-section group rounded-2xl border border-accent/20 bg-bg/65 p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      {normalizedServicesCatalog.assistantsTitle}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {assistantsSubtotal?.description || "Sin asistentes"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pl-3">
                    <span className="text-xs font-semibold text-fg/85">
                      {formatExtraPriceLabel(assistantsSubtotal?.amount ?? 0)}
                    </span>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent/25 text-accent transition-transform group-open:rotate-180">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                  </div>
                </summary>
                <div className="mt-3">
                  <p className="text-xs text-muted">
                    {normalizedServicesCatalog.assistantsHint}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setAssistantsCount(selectedServices.assistantsCount - 1)
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent/30 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent/10"
                    >
                      -
                    </button>
                    <span className="min-w-10 text-center text-sm font-semibold text-fg">
                      {selectedServices.assistantsCount}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAssistantsCount(selectedServices.assistantsCount + 1)
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent/30 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent/10"
                    >
                      +
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Tarifa:{" "}
                    {formatExtraPriceLabel(normalizedServicesCatalog.assistantsRatePerHour)}{" "}
                    x hora por asistente
                  </p>
                </div>
              </details>

              <div className="booking-services-section rounded-2xl border border-accent/20 bg-bg/75 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  {normalizedServicesCatalog.totalsTitle}
                </p>
                <div className="mt-2 space-y-1 text-xs text-fg/90">
                  {servicesBreakdown.subtotals.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3">
                      <span>{item.label}</span>
                      <span className="font-semibold">
                        {formatExtraPriceLabel(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-fg">
                  <span>Total servicios</span>
                  <span>{formatExtraPriceLabel(servicesTotal)}</span>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmServices}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-accent/55 bg-accent/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-accent transition-all duration-200 hover:-translate-y-0.5 hover:border-accent2 hover:bg-accent2 hover:text-bg hover:shadow-[0_14px_28px_-18px_rgba(0,0,0,0.75)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 active:translate-y-0"
                >
                  Confirmar
                </button>
              </div>

              {servicesError ? (
                <span className="text-xs text-accent">{servicesError}</span>
              ) : null}
            </div>
          </div>
        ) : null}
        {servicesError && !showServicesPanel ? (
          <span className="text-xs text-accent">{servicesError}</span>
        ) : null}
      </div>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={toggleExtrasPanel}
          className={sectionToggleButtonClass}
          aria-label="Editar fondos"
          aria-expanded={isExtrasExpanded}
          aria-controls="booking-extras-panel"
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-fg">
            Fondos
          </span>
          {renderSectionEditIcon()}
        </button>

        {showExtrasPanel ? (
          <div
            id="booking-extras-panel"
            className={sectionContentTransitionClass(isExtrasExpanded)}
          >
      <div className="booking-extras grid gap-2 rounded-2xl border border-accent/15 bg-white/80 px-4 py-4">
        {normalizedExtraBackgrounds.length === 0 ? (
          <p className="text-sm text-muted">No hay fondos configurados.</p>
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
          </div>
        ) : null}
        {extrasError && !showExtrasPanel ? (
          <span className="text-xs text-accent">{extrasError}</span>
        ) : null}
      </div>

      <div className="booking-summary rounded-2xl border border-accent/15 bg-bg px-4 py-3 text-sm">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
          <span>Horas</span>
          <span>
            ${pricingSummary.totalBaseWithSurcharges.toLocaleString("es-AR")}
          </span>
        </div>
        <div className="mt-1 text-xs text-muted">{hoursBreakdownLabel}</div>
        {surchargesBreakdownLabel ? (
          <div className="mt-1 text-xs text-muted">
            Recargos incluidos: {surchargesBreakdownLabel}
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
          <span>Fondos</span>
          <span>${extrasTotal.toLocaleString("es-AR")}</span>
        </div>
        {selectedExtras.length > 0 && (
          <div className="mt-1 text-xs text-muted">
            {selectedExtras.map((extra) => extra.label).join(", ")}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
          <span>Servicios</span>
          <span>${servicesTotal.toLocaleString("es-AR")}</span>
        </div>
        {selectedPhotographyOption ? (
          <div className="mt-1 text-xs text-muted">
            Foto base: {selectedPhotographyOption.label}
            {selectedPhotographyOption.minHours
              ? ` (min ${selectedPhotographyOption.minHours}h)`
              : ""}
            {selectedMakeupOption ? ` | Makeup: ${selectedMakeupOption.label}` : ""}
          </div>
        ) : null}
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
      </div>

      {apiError && (
        <div
          className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent"
          role="alert"
        >
          {apiError}
        </div>
      )}

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

      {isGuideModalOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 px-3 py-4 backdrop-blur-[2px] sm:px-4 sm:py-6">
              <button
                type="button"
                aria-label="Cerrar instructivo"
                onClick={closeGuideModal}
                className="absolute inset-0 h-full w-full cursor-default"
              />

              <div
                className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-accent/20 bg-bg p-4 shadow-[0_34px_70px_-42px_rgba(0,0,0,0.8)] sm:p-6"
                role="dialog"
                aria-modal="true"
                aria-labelledby="booking-guide-title"
              >
                <button
                  type="button"
                  onClick={closeGuideModal}
                  className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent/20 text-accent/70 transition hover:border-accent/40 hover:text-accent"
                  aria-label="Cerrar modal de instructivo"
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

                <div className="pr-9">
                  <p
                    id="booking-guide-title"
                    className="text-xs font-semibold uppercase tracking-[0.22em] text-muted"
                  >
                    Instructivo de reserva
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Para editar, elegi un nuevo bloque horario y ajusta servicios
                    y fondos antes de confirmar.
                  </p>
                </div>

                <ol className="mt-5 space-y-3 text-sm text-muted">
                  <li className="rounded-2xl border border-accent/20 bg-bg/90 px-4 py-3">
                    1. Toca un dia en el calendario para abrir sus horarios.
                  </li>
                  <li className="rounded-2xl border border-accent/20 bg-bg/90 px-4 py-3">
                    2. Selecciona minimo 2 horas consecutivas.
                  </li>
                  <li className="rounded-2xl border border-accent/20 bg-bg/90 px-4 py-3">
                    3. Se reserva 1 hora posterior para mantenimiento, no se cobra y es para uso exclusivo de UNKT para asegurar el funcionamiento correcto del taller.
                  </li>
                  <li className="rounded-2xl border border-accent/20 bg-bg/90 px-4 py-3">
                    4. Configura servicios, luego activa fondos y elige el modo de cada fondo.
                  </li>
                  <li className="rounded-2xl border border-accent/20 bg-bg/90 px-4 py-3">
                    5. Revisa el total y confirma con &quot;Reservar y pagar&quot;.
                  </li>
                </ol>
              </div>
            </div>,
            document.body
          )
        : null}

      <PoliciesModal
        isOpen={isPolicyModalOpen}
        onClose={closePolicyModal}
        policies={policies}
      />
    </form>
  );
}


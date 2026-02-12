"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import { BOOKING_TIMEZONE } from "@/lib/booking";

type SlotStatus = "available" | "booked";

type SlotItem = {
  id: string;
  start: string;
  end: string;
  status: SlotStatus;
};

type BookingItem = {
  id: string;
  title: string;
  start: string;
  end: string;
  status: string;
  email: string;
  phone: string;
  extrasLabel: string;
  totalLabel: string;
};

type BookingPopover = {
  booking: BookingItem;
  x: number;
  y: number;
};

type MonthCounterKind = "booked" | "available";

type MonthCounterEvent = {
  id: string;
  title: string;
  start: string;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    type: "month-counter";
    dayKey: string;
    counterKind: MonthCounterKind;
    count: number;
    chipBg: string;
    chipText: string;
  };
};

type VisibleRange = {
  startISO: string;
  endISO: string;
};

type AdminAgendaPanelProps = {
  slots: SlotItem[];
  bookings: BookingItem[];
};

type ToastStatus = "idle" | "saving" | "saved" | "error";
type TimeWindowMode = "am" | "pm";
const HELP_GUIDE_PREF_KEY = "unkt_admin_agenda_hide_help_guides";

const timeWindowConfig: Record<
  TimeWindowMode,
  { slotMin: string; slotMax: string; scroll: string }
> = {
  am: {
    slotMin: "00:00:00",
    slotMax: "12:00:00",
    scroll: "08:00:00",
  },
  pm: {
    slotMin: "12:00:00",
    slotMax: "24:00:00",
    scroll: "12:00:00",
  },
};

const slotStatusLabels: Record<SlotStatus, string> = {
  available: "Disponible",
  booked: "Reservado",
};

const slotColors: Record<SlotStatus, { bg: string; text: string }> = {
  available: { bg: "var(--accent)", text: "var(--bg)" },
  booked: { bg: "var(--muted)", text: "var(--bg)" },
};

const nightSlotColors: Record<SlotStatus, { bg: string; text: string }> = {
  available: {
    bg: "color-mix(in srgb, var(--accent) 68%, var(--accent2) 32%)",
    text: "var(--bg)",
  },
  booked: {
    bg: "color-mix(in srgb, var(--accent2) 62%, var(--muted) 38%)",
    text: "var(--bg)",
  },
};

const bookingColors: Record<string, { bg: string; text: string }> = {
  paid: { bg: "var(--accent)", text: "var(--bg)" },
  pending_payment: { bg: "var(--accent2)", text: "var(--bg)" },
};

const nightBookingColors: Record<string, { bg: string; text: string }> = {
  paid: {
    bg: "color-mix(in srgb, var(--accent) 62%, var(--accent2) 38%)",
    text: "var(--bg)",
  },
  pending_payment: {
    bg: "color-mix(in srgb, var(--accent2) 72%, var(--accent) 28%)",
    text: "var(--bg)",
  },
};

const bookingFallbackColors = {
  light: { bg: "var(--muted)", text: "var(--bg)" },
  dark: {
    bg: "color-mix(in srgb, var(--accent2) 58%, var(--muted) 42%)",
    text: "var(--bg)",
  },
} as const;

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

const dayLabelFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: BOOKING_TIMEZONE,
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const normalizeIso = (value: string) =>
  value.length === 10 ? `${value}T00:00:00` : value;
const toDate = (value: string) => new Date(normalizeIso(value));

const getDateKey = (iso: string) => dateKeyFormatter.format(toDate(iso));
const formatTime = (iso: string) => timeFormatter.format(toDate(iso));

const formatRangeLabel = (startIso: string, endIso: string) => {
  const start = toDate(startIso);
  const end = toDate(endIso);
  const durationHours = (end.getTime() - start.getTime()) / 3600000;
  const startTime = formatTime(startIso);
  const endTime = formatTime(endIso);
  if (startTime === "00:00" && endTime === "00:00" && durationHours >= 23) {
    return "Todo el dia";
  }
  return `${startTime} - ${endTime}`;
};

const formatDayLabel = (dayKey: string) => {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) {
    return dayKey;
  }
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return dayLabelFormatter.format(date);
};

const isDateOnlyKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const addDaysToDayKey = (dayKey: string, amount: number) => {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) {
    return dayKey;
  }
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

const hasTimeOverlap = (
  startA: number,
  endA: number,
  startB: number,
  endB: number
) => startA < endB && startB < endA;

export default function AdminAgendaPanel({
  slots,
  bookings,
}: AdminAgendaPanelProps) {
  const router = useRouter();
  const calendarContainerRef = useRef<HTMLDivElement | null>(null);
  const [localSlots, setLocalSlots] = useState<SlotItem[]>(slots);
  const [isMobile, setIsMobile] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingPopover | null>(
    null
  );
  const [monthDetailDayKey, setMonthDetailDayKey] = useState<string | null>(null);
  const [pendingSlotActionId, setPendingSlotActionId] = useState<string | null>(
    null
  );
  const [availabilityView, setAvailabilityView] = useState("timeGridWeek");
  const [timeWindowMode, setTimeWindowMode] = useState<TimeWindowMode>("am");
  const [visibleRange, setVisibleRange] = useState<VisibleRange | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [hideHelpGuides, setHideHelpGuides] = useState(false);
  const [status, setStatus] = useState<ToastStatus>("idle");
  const [message, setMessage] = useState("");
  const [calendarDateRowLabel, setCalendarDateRowLabel] = useState("");
  const hideTimer = useRef<number | null>(null);
  const isMonthView = availabilityView === "dayGridMonth";
  const effectiveTimeWindowMode: TimeWindowMode = timeWindowMode;
  const isPmWindow = effectiveTimeWindowMode === "pm";
  const useDarkMonthDetailPalette = isDarkTheme;
  const activeSlotColors = useDarkMonthDetailPalette ? nightSlotColors : slotColors;
  const activeBookingColors = useDarkMonthDetailPalette
    ? nightBookingColors
    : bookingColors;
  const fallbackBookingPalette = useDarkMonthDetailPalette
    ? bookingFallbackColors.dark
    : bookingFallbackColors.light;
  const activeWindow = timeWindowConfig[effectiveTimeWindowMode];
  const monthDetailDialogClass = useDarkMonthDetailPalette
    ? "border-accent2/40 bg-bg/95 text-fg"
    : "border-accent/20 bg-white text-fg";
  const monthDetailHeadingClass = "text-fg";
  const monthDetailMutedClass = "text-muted";
  const monthDetailStrongClass = "text-fg";
  const monthDetailSectionClass = useDarkMonthDetailPalette
    ? "border-accent2/28 bg-bg/80"
    : "border-accent/15 bg-bg/70";
  const monthDetailCardClass = useDarkMonthDetailPalette
    ? "border-accent2/24 bg-bg/75"
    : "border-accent/12 bg-white/90";
  const monthDetailSecondaryButtonClass = useDarkMonthDetailPalette
    ? "border-accent2/45 bg-bg/80 text-fg hover:border-accent2 hover:bg-accent2/15"
    : "border-accent/30 bg-bg text-muted hover:border-accent/55 hover:bg-accent/10";
  const monthDetailPrimaryButtonClass = useDarkMonthDetailPalette
    ? "border-accent2/50 bg-accent2 text-bg hover:bg-accent"
    : "border-accent/40 bg-accent text-bg hover:bg-accent2";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(root.dataset.theme === "dark");
    syncTheme();

    const observer = new MutationObserver((changes) => {
      if (
        changes.some(
          (change) =>
            change.type === "attributes" && change.attributeName === "data-theme"
        )
      ) {
        syncTheme();
      }
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    window.addEventListener("unkt-theme-change", syncTheme);
    window.addEventListener("storage", syncTheme);

    return () => {
      observer.disconnect();
      window.removeEventListener("unkt-theme-change", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      setHideHelpGuides(window.localStorage.getItem(HELP_GUIDE_PREF_KEY) === "1");
    } catch {
      setHideHelpGuides(false);
    }
  }, []);

  useEffect(() => {
    setLocalSlots(slots);
  }, [slots]);

  useEffect(() => {
    if (!isMonthView) {
      setMonthDetailDayKey(null);
    }
  }, [isMonthView]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    if (media.addEventListener) {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showHelpGuide) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowHelpGuide(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showHelpGuide]);

  const setHelpGuidesHidden = (hidden: boolean) => {
    setHideHelpGuides(hidden);
    if (hidden) {
      setShowHelpGuide(false);
    }
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(HELP_GUIDE_PREF_KEY, hidden ? "1" : "0");
    } catch {
      // Ignore storage failures (private mode / disabled storage)
    }
  };

  useEffect(() => {
    const container = calendarContainerRef.current;
    if (!container) {
      return;
    }

    const clearAxisToggle = () => {
      const existing = container.querySelectorAll<HTMLButtonElement>(
        ".agenda-axis-window-toggle"
      );
      existing.forEach((button) => {
        button.onclick = null;
        button.remove();
      });
      const hosts = container.querySelectorAll<HTMLElement>(".agenda-axis-toggle-host");
      hosts.forEach((host) => host.classList.remove("agenda-axis-toggle-host"));
    };

    if (isMonthView) {
      clearAxisToggle();
      return;
    }

    const attachButton = () => {
      const axisCell =
        container.querySelector<HTMLTableCellElement>(
          ".fc .fc-timegrid-head thead .fc-timegrid-axis"
        ) ??
        container.querySelector<HTMLTableCellElement>(
          ".fc .fc-timegrid thead .fc-timegrid-axis"
        );
      if (!axisCell) {
        return false;
      }

      const axisHost = axisCell;
      axisHost.classList.add("agenda-axis-toggle-host");

      let button = axisHost.querySelector<HTMLButtonElement>(
        ".agenda-axis-window-toggle"
      );
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "agenda-axis-window-toggle";
        axisHost.appendChild(button);
      }

      button.textContent = isPmWindow ? "PM" : "AM";
      button.setAttribute("aria-label", isPmWindow ? "Cambiar a AM" : "Cambiar a PM");
      button.classList.toggle("agenda-axis-window-toggle--night", useDarkMonthDetailPalette);
      button.classList.toggle(
        "agenda-axis-window-toggle--day",
        !useDarkMonthDetailPalette
      );
      button.onclick = () =>
        setTimeWindowMode((prev) => (prev === "am" ? "pm" : "am"));

      return true;
    };

    let frameId: number | null = null;
    let attempts = 0;
    const tryAttach = () => {
      if (attachButton()) {
        return;
      }
      attempts += 1;
      if (attempts < 30) {
        frameId = window.requestAnimationFrame(tryAttach);
      }
    };

    clearAxisToggle();
    tryAttach();

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      clearAxisToggle();
    };
  }, [
    isMonthView,
    isPmWindow,
    useDarkMonthDetailPalette,
    availabilityView,
    visibleRange?.startISO,
    visibleRange?.endISO,
  ]);

  useEffect(() => {
    const container = calendarContainerRef.current;
    if (!container) {
      return;
    }

    const clearDateRow = () => {
      const existing = container.querySelectorAll<HTMLElement>(
        ".agenda-toolbar-date-row"
      );
      existing.forEach((row) => row.remove());
    };

    const attachDateRow = () => {
      const toolbar = container.querySelector<HTMLElement>(".fc .fc-header-toolbar");
      if (!toolbar) {
        return false;
      }

      const title = toolbar
        .querySelector<HTMLElement>(".fc-toolbar-title")
        ?.textContent?.trim();
      const label = calendarDateRowLabel || title || "";
      if (!label) {
        return false;
      }

      let row = container.querySelector<HTMLElement>(".agenda-toolbar-date-row");
      if (!row) {
        row = document.createElement("div");
        row.className = "agenda-toolbar-date-row";
        toolbar.insertAdjacentElement("afterend", row);
      }

      row.textContent = label;
      row.classList.toggle("agenda-toolbar-date-row--night", useDarkMonthDetailPalette);
      row.classList.toggle("agenda-toolbar-date-row--day", !useDarkMonthDetailPalette);
      return true;
    };

    let frameId: number | null = null;
    let attempts = 0;
    const tryAttach = () => {
      if (attachDateRow()) {
        return;
      }
      attempts += 1;
      if (attempts < 30) {
        frameId = window.requestAnimationFrame(tryAttach);
      }
    };

    clearDateRow();
    tryAttach();

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      clearDateRow();
    };
  }, [
    calendarDateRowLabel,
    availabilityView,
    visibleRange?.startISO,
    visibleRange?.endISO,
    useDarkMonthDetailPalette,
    isMobile,
  ]);

  const showToast = (nextStatus: ToastStatus, text: string) => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
    }
    setStatus(nextStatus);
    setMessage(text);
    hideTimer.current = window.setTimeout(() => {
      setStatus("idle");
      setMessage("");
    }, 1600);
  };

  const getClearScopeDescription = () => {
    if (availabilityView.includes("Week")) {
      return effectiveTimeWindowMode === "pm"
        ? "la franja PM de la semana visible (12:00 a 24:00)"
        : "la franja AM de la semana visible (00:00 a 12:00)";
    }
    if (availabilityView.includes("Day")) {
      return effectiveTimeWindowMode === "pm"
        ? "la franja PM del dia visible (12:00 a 24:00)"
        : "la franja AM del dia visible (00:00 a 12:00)";
    }
    return "todo el mes visible";
  };

  const requestClearVisibleRange = () => {
    if (!visibleRange || status === "saving") return;
    setSelectedBooking(null);
    setShowHelpGuide(false);
    setShowClearConfirm(true);
  };

  const rightToolbarButtons = hideHelpGuides
    ? isMobile
      ? "dayGridMonth,timeGridDay"
      : "dayGridMonth,timeGridWeek,timeGridDay"
    : isMobile
      ? "dayGridMonth,timeGridDay,helpGuide"
      : "dayGridMonth,timeGridWeek,timeGridDay,helpGuide";

  const handleClearVisibleRange = async () => {
    if (!visibleRange || status === "saving") return;

    setSelectedBooking(null);
    setShowClearConfirm(false);
    setStatus("saving");
    setMessage("Borrando...");

    try {
      const response = await fetch("/api/admin/availability", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          startISO: visibleRange.startISO,
          endISO: visibleRange.endISO,
          viewType: availabilityView,
          timeWindowMode: effectiveTimeWindowMode,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast("error", data.error || "No se pudo borrar la vista.");
        return;
      }

      const deletedCount =
        typeof data.deletedCount === "number" ? data.deletedCount : null;
      if (deletedCount !== null) {
        showToast(
          "saved",
          deletedCount > 0
            ? `${deletedCount} horario(s) eliminados.`
            : "No habia horarios para borrar."
        );
      } else {
        showToast("saved", "Vista limpiada.");
      }
      router.refresh();
    } catch {
      showToast("error", "No se pudo borrar la vista.");
    }
  };

  const openBookingPopover = (
    booking: BookingItem,
    eventElement?: HTMLElement | null,
    clickEvent?: MouseEvent
  ) => {
    const container = calendarContainerRef.current;
    if (!container) {
      setSelectedBooking({ booking, x: 12, y: 12 });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const eventRect = eventElement?.getBoundingClientRect();
    const popoverWidth = 260;
    const popoverHeight = 142;
    const margin = 8;
    const preferredCenterX = eventRect
      ? eventRect.left + eventRect.width / 2
      : clickEvent?.clientX ?? containerRect.left + containerRect.width / 2;
    const preferredTop =
      eventRect?.top ?? clickEvent?.clientY ?? containerRect.top + 80;

    let x = preferredCenterX - containerRect.left - popoverWidth / 2;
    x = Math.max(margin, Math.min(x, containerRect.width - popoverWidth - margin));

    let y = preferredTop - containerRect.top - popoverHeight - margin;
    if (y < margin) {
      const bottomAnchor =
        eventRect?.bottom ?? clickEvent?.clientY ?? containerRect.top + margin;
      y = bottomAnchor - containerRect.top + margin;
    }

    setSelectedBooking({ booking, x, y });
  };

  const daySlotGroups = useMemo(() => {
    const grouped = new Map<
      string,
      { available: SlotItem[]; booked: SlotItem[] }
    >();

    localSlots.forEach((slot) => {
      const dateKey = getDateKey(slot.start);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, { available: [], booked: [] });
      }
      grouped.get(dateKey)![slot.status].push(slot);
    });

    grouped.forEach((slotsByStatus) => {
      slotsByStatus.available.sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      );
      slotsByStatus.booked.sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      );
    });

    return grouped;
  }, [localSlots]);

  const dayBookingGroups = useMemo(() => {
    const grouped = new Map<string, BookingItem[]>();
    bookings.forEach((booking) => {
      const dateKey = getDateKey(booking.start);
      const list = grouped.get(dateKey) ?? [];
      list.push(booking);
      grouped.set(dateKey, list);
    });

    grouped.forEach((bookingList) => {
      bookingList.sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      );
    });

    return grouped;
  }, [bookings]);

  const monthVisibleDayKeys = useMemo(() => {
    if (!isMonthView || !visibleRange) {
      return [] as string[];
    }
    const start = new Date(visibleRange.startISO);
    const end = new Date(visibleRange.endISO);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return [] as string[];
    }

    const dayKeys: string[] = [];
    const seen = new Set<string>();
    const cursor = new Date(start);
    while (cursor < end) {
      const dayKey = dateKeyFormatter.format(cursor);
      if (!seen.has(dayKey)) {
        seen.add(dayKey);
        dayKeys.push(dayKey);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return dayKeys;
  }, [isMonthView, visibleRange]);

  const monthCounterEvents = useMemo<MonthCounterEvent[]>(() => {
    if (!isMonthView) {
      return [];
    }

    const defaultDayKeys = [...daySlotGroups.keys(), ...dayBookingGroups.keys()];
    const dayKeys = monthVisibleDayKeys.length
      ? monthVisibleDayKeys
      : Array.from(new Set(defaultDayKeys)).sort();

    return dayKeys.flatMap((dayKey) => {
      const bookingCount = dayBookingGroups.get(dayKey)?.length ?? 0;
      const availableCount = daySlotGroups.get(dayKey)?.available.length ?? 0;

      return [
        {
          id: `month-booked-${dayKey}`,
          title: String(bookingCount),
          start: dayKey,
          allDay: true,
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          textColor: 'inherit',
          extendedProps: {
            type: 'month-counter',
            dayKey,
            counterKind: 'booked',
            count: bookingCount,
            chipBg: activeSlotColors.booked.bg,
            chipText: activeSlotColors.booked.text,
          },
        },
        {
          id: `month-available-${dayKey}`,
          title: String(availableCount),
          start: dayKey,
          allDay: true,
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          textColor: 'inherit',
          extendedProps: {
            type: 'month-counter',
            dayKey,
            counterKind: 'available',
            count: availableCount,
            chipBg: activeSlotColors.available.bg,
            chipText: activeSlotColors.available.text,
          },
        },
      ];
    });
  }, [
    isMonthView,
    monthVisibleDayKeys,
    daySlotGroups,
    dayBookingGroups,
    activeSlotColors,
  ]);

  const availabilityEvents = useMemo(() => {
    if (isMonthView) {
      return [];
    }

    return localSlots.map((slot) => ({
      id: slot.id,
      title: `${formatRangeLabel(slot.start, slot.end)} · ${
        slotStatusLabels[slot.status]
      }`,
      start: slot.start,
      end: slot.end,
      backgroundColor: activeSlotColors[slot.status].bg,
      borderColor: activeSlotColors[slot.status].bg,
      textColor: activeSlotColors[slot.status].text,
      extendedProps: {
        status: slot.status,
        dayKey: getDateKey(slot.start),
        type: 'slot',
      },
    }));
  }, [isMonthView, localSlots, activeSlotColors]);

  const bookingEvents = useMemo(() => {
    if (isMonthView) {
      return [];
    }

    return bookings.map((booking) => {
      const palette = activeBookingColors[booking.status] ?? fallbackBookingPalette;

      return {
        id: booking.id,
        title: booking.title,
        start: booking.start,
        end: booking.end,
        backgroundColor: palette.bg,
        borderColor: palette.bg,
        textColor: palette.text,
        extendedProps: { ...booking, type: 'booking' },
      };
    });
  }, [isMonthView, bookings, activeBookingColors, fallbackBookingPalette]);

  const combinedEvents = useMemo(
    () =>
      isMonthView
        ? monthCounterEvents
        : [...availabilityEvents, ...bookingEvents],
    [isMonthView, monthCounterEvents, availabilityEvents, bookingEvents]
  );

  const monthDetailData = useMemo(() => {
    if (!monthDetailDayKey) {
      return null;
    }

    const slotsByStatus = daySlotGroups.get(monthDetailDayKey) ?? {
      available: [],
      booked: [],
    };

    return {
      dayKey: monthDetailDayKey,
      dayLabel: formatDayLabel(monthDetailDayKey),
      bookings: dayBookingGroups.get(monthDetailDayKey) ?? [],
      availableSlots: slotsByStatus.available,
      bookedSlots: slotsByStatus.booked,
    };
  }, [monthDetailDayKey, daySlotGroups, dayBookingGroups]);

  const handleSelect = async (selection: {
    startStr: string;
    endStr: string;
  }) => {
    setSelectedBooking(null);

    const selectionRange = (() => {
      if (!isMonthView) {
        return {
          startISO: selection.startStr,
          endISO: selection.endStr,
        };
      }

      const dayKey = isDateOnlyKey(selection.startStr)
        ? selection.startStr
        : getDateKey(selection.startStr);

      return {
        startISO: dayKey,
        endISO: addDaysToDayKey(dayKey, 1),
      };
    })();

    setStatus("saving");
    setMessage("Guardando...");

    try {
      const response = await fetch("/api/admin/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          startISO: selectionRange.startISO,
          endISO: selectionRange.endISO,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(
          "error",
          data.error || "No se pudieron agregar horarios."
        );
        return;
      }
      showToast("saved", "Horarios agregados como disponibles.");
      router.refresh();
    } catch {
      showToast("error", "No se pudieron agregar horarios.");
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (pendingSlotActionId) {
      return;
    }

    setPendingSlotActionId(slotId);
    try {
      const response = await fetch("/api/admin/availability", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ slotId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast("error", data.error || "No se pudo eliminar.");
        return;
      }

      setLocalSlots((prev) => prev.filter((slot) => slot.id !== slotId));
      showToast("saved", "Horario eliminado.");
    } catch {
      showToast("error", "No se pudo eliminar.");
    } finally {
      setPendingSlotActionId((current) => (current === slotId ? null : current));
    }
  };

  const removeOverlappingAvailableSlots = async (booking: BookingItem) => {
    const bookingStart = toDate(booking.start).getTime();
    const bookingEnd = toDate(booking.end).getTime();
    if (!Number.isFinite(bookingStart) || !Number.isFinite(bookingEnd)) {
      return;
    }

    const overlappingAvailableSlots = localSlots.filter((slot) => {
      if (slot.status !== "available") {
        return false;
      }
      const slotStart = toDate(slot.start).getTime();
      const slotEnd = toDate(slot.end).getTime();
      return hasTimeOverlap(slotStart, slotEnd, bookingStart, bookingEnd);
    });

    if (!overlappingAvailableSlots.length) {
      return;
    }

    setStatus("saving");
    setMessage("Actualizando...");

    const deletionResults = await Promise.allSettled(
      overlappingAvailableSlots.map(async (slot) => {
        const response = await fetch("/api/admin/availability", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ slotId: slot.id }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof data.error === "string" ? data.error : "No se pudo limpiar.";
          throw new Error(message);
        }
        return slot.id;
      })
    );

    const removedIds = deletionResults
      .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
      .map((result) => result.value);
    const failed = deletionResults.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );

    if (removedIds.length) {
      const removedIdSet = new Set(removedIds);
      setLocalSlots((prev) => prev.filter((slot) => !removedIdSet.has(slot.id)));
      router.refresh();
    }

    if (failed.length) {
      const reason = failed[0].reason;
      const reasonText =
        reason instanceof Error && reason.message
          ? reason.message
          : "No se pudieron limpiar horarios superpuestos.";
      showToast("error", reasonText);
      return;
    }

    showToast(
      "saved",
      `${removedIds.length} horario(s) disponible(s) limpiados por reserva.`
    );
  };

  return (
    <div className="grid gap-10">
      {showClearConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cerrar confirmacion"
            className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
            onClick={() => setShowClearConfirm(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-confirm-title"
            aria-describedby="clear-confirm-description"
            className={`relative w-full max-w-md rounded-3xl border px-5 py-4 shadow-[0_28px_60px_-32px_rgba(0,0,0,0.65)] ${
              useDarkMonthDetailPalette
                ? "border-accent2/40 bg-bg/95 text-fg"
                : "border-accent/25 bg-white text-fg"
            }`}
          >
            <h3
              id="clear-confirm-title"
              className="text-sm font-semibold uppercase tracking-wide text-fg"
            >
              Confirmar limpieza
            </h3>
            <p
              id="clear-confirm-description"
              className="mt-2 text-sm leading-relaxed text-muted"
            >
              Vas a borrar {getClearScopeDescription()}. Solo se eliminan horarios
              disponibles.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className={`rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-wide transition ${
                  monthDetailSecondaryButtonClass
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearVisibleRange}
                className={`rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-wide transition ${
                  monthDetailPrimaryButtonClass
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {showHelpGuide && (
        <div className="fixed inset-0 z-[82] flex items-center justify-center p-4">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/45 backdrop-blur-[3px]"
          />
          <div
            id="agenda-help-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="agenda-help-title"
            className={`relative w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-3xl border px-5 py-4 text-left shadow-[0_28px_60px_-32px_rgba(0,0,0,0.75)] sm:px-6 sm:py-5 ${
              useDarkMonthDetailPalette
                ? "border-accent2/42 bg-bg/96 text-fg"
                : "border-accent/24 bg-white text-fg"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <strong
                id="agenda-help-title"
                className="text-xs font-semibold uppercase tracking-wide text-fg"
              >
                Guia rapida
              </strong>
              <button
                type="button"
                onClick={() => setShowHelpGuide(false)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs transition ${
                  useDarkMonthDetailPalette
                    ? "border-accent2/40 bg-bg/82 text-fg hover:border-accent2"
                    : "border-accent/25 bg-bg text-muted hover:border-accent/55"
                }`}
                aria-label="Cerrar ayuda"
              >
                x
              </button>
            </div>

            <p className="mt-2 text-sm leading-relaxed text-muted">
              Referencia de colores y uso rapido de la agenda.
            </p>

            <div className="mt-4 grid gap-2 text-[11px] font-semibold uppercase tracking-wide">
              <span
                className={`inline-flex h-8 items-center gap-2 rounded-full px-3 ${
                  useDarkMonthDetailPalette
                    ? "border border-accent2/28 bg-bg/82 text-fg"
                    : "border border-accent/20 bg-bg/60 text-fg"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: activeSlotColors.available.bg }}
                />
                Disponible
              </span>
              <span
                className={`inline-flex h-8 items-center gap-2 rounded-full px-3 ${
                  useDarkMonthDetailPalette
                    ? "border border-accent2/28 bg-bg/82 text-fg"
                    : "border border-accent/20 bg-bg/60 text-fg"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: activeSlotColors.booked.bg }}
                />
                Reservado
              </span>
            </div>

            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
              <li>Toque o arrastre para crear horarios disponibles.</li>
              <li>Toque una reserva para ver datos y limpiar solapes.</li>
              <li>Use el boton limpiar para borrar la vista actual.</li>
            </ul>

            <label
              className={`mt-4 flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold tracking-wide ${
                useDarkMonthDetailPalette
                  ? "border-accent2/28 bg-bg/82 text-fg"
                  : "border-accent/20 bg-bg/60 text-fg"
              }`}
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-accent2"
                checked={hideHelpGuides}
                onChange={(event) => setHelpGuidesHidden(event.target.checked)}
              />
              No mostrar ayudas otra vez
            </label>
          </div>
        </div>
      )}

      {monthDetailData && (
        <div className="fixed inset-0 z-[78] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cerrar detalle diario"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setMonthDetailDayKey(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="month-detail-title"
            className={`relative w-full max-w-4xl rounded-3xl border px-5 py-5 shadow-[0_35px_90px_-40px_rgba(0,0,0,0.8)] sm:px-6 sm:py-6 ${
              monthDetailDialogClass
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="month-detail-title"
                  className={`text-sm font-semibold uppercase tracking-wide ${monthDetailHeadingClass}`}
                >
                  Detalle del dia
                </h3>
                <p className={`mt-1 text-sm ${monthDetailMutedClass}`}>
                  {monthDetailData.dayLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMonthDetailDayKey(null)}
                className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                  monthDetailSecondaryButtonClass
                }`}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <section
                className={`rounded-2xl border p-4 ${
                  monthDetailSectionClass
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide">
                    Reservas
                  </h4>
                  <span className="text-xs font-semibold">{monthDetailData.bookings.length}</span>
                </div>

                <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
                  {monthDetailData.bookings.length ? (
                    monthDetailData.bookings.map((booking) => {
                      const bookingPalette =
                        activeBookingColors[booking.status] ?? fallbackBookingPalette;

                      return (
                        <article
                          key={booking.id}
                          className={`rounded-xl border p-3 text-xs ${
                            monthDetailCardClass
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong>{formatRangeLabel(booking.start, booking.end)}</strong>
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                              style={{
                                backgroundColor: bookingPalette.bg,
                                color: bookingPalette.text,
                              }}
                            >
                              {booking.status === "paid" ? "Pagada" : "Pendiente"}
                            </span>
                          </div>
                          <div className="mt-1 font-semibold">{booking.title}</div>
                          <div className={monthDetailMutedClass}>
                            {booking.email}
                          </div>
                          <div className={monthDetailMutedClass}>
                            {booking.phone}
                          </div>
                          <div className={monthDetailMutedClass}>
                            {booking.extrasLabel}
                          </div>
                          <div className={monthDetailStrongClass}>
                            {booking.totalLabel}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className={`text-xs ${monthDetailMutedClass}`}>
                      No hay reservas en este dia.
                    </p>
                  )}
                </div>
              </section>

              <section
                className={`rounded-2xl border p-4 ${
                  monthDetailSectionClass
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide">
                    Disponibles
                  </h4>
                  <span className="text-xs font-semibold">
                    {monthDetailData.availableSlots.length}
                  </span>
                </div>

                <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
                  {monthDetailData.availableSlots.length ? (
                    monthDetailData.availableSlots.map((slot) => {
                      const isPending = pendingSlotActionId === slot.id;
                      return (
                        <article
                          key={slot.id}
                          className={`rounded-xl border p-3 text-xs ${
                            monthDetailCardClass
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong>{formatRangeLabel(slot.start, slot.end)}</strong>
                            <button
                              type="button"
                              onClick={() => handleDeleteSlot(slot.id)}
                              disabled={isPending}
                              className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                monthDetailPrimaryButtonClass
                              }`}
                            >
                              Eliminar
                            </button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className={`text-xs ${monthDetailMutedClass}`}>
                      No hay horarios disponibles en este dia.
                    </p>
                  )}
                </div>
              </section>
            </div>

            <div className="mt-4">
              <section
                className={`rounded-2xl border p-4 ${
                  monthDetailSectionClass
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide">
                    Slots reservados
                  </h4>
                  <span className="text-xs font-semibold">
                    {monthDetailData.bookedSlots.length}
                  </span>
                </div>
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                  {monthDetailData.bookedSlots.length ? (
                    monthDetailData.bookedSlots.map((slot) => (
                      <article
                        key={slot.id}
                        className={`rounded-xl border p-3 text-xs ${
                          monthDetailCardClass
                        }`}
                      >
                        <strong>{formatRangeLabel(slot.start, slot.end)}</strong>
                      </article>
                    ))
                  ) : (
                    <p className={`text-xs ${monthDetailMutedClass}`}>
                      No hay slots en estado reservado.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {status !== "idle" && (
        <div className="pointer-events-none fixed inset-x-4 top-4 z-[70] flex justify-center sm:justify-end">
          <div
            className={`pointer-events-auto min-w-[14rem] max-w-[90vw] rounded-2xl border px-4 py-3 text-[11px] font-semibold tracking-wide shadow-[0_20px_40px_-28px_rgba(0,0,0,0.45)] backdrop-blur sm:max-w-md ${
              status === "saved"
                ? "border-accent/30 bg-accent/10 text-accent"
                : status === "saving"
                  ? "border-accent/20 bg-bg/95 text-muted"
                  : "border-accent/40 bg-accent/10 text-accent"
            }`}
            role={status === "error" ? "alert" : "status"}
            aria-live={status === "error" ? "assertive" : "polite"}
          >
            {message}
          </div>
        </div>
      )}

      <section
        className={`agenda-panel agenda-calendar rounded-3xl p-4 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-8 ${
          useDarkMonthDetailPalette
            ? "agenda-panel--night agenda-calendar--night bg-bg text-fg shadow-[0_40px_90px_-55px_rgba(0,0,0,0.95)]"
            : "agenda-panel--day agenda-calendar--day bg-white text-fg shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)]"
        }`}
      >
        <div className="agenda-header-layer flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-[0.08em] text-fg transition-colors duration-500">
              Disponibilidad
            </h1>
          </div>
        </div>

        <div
          ref={calendarContainerRef}
          className={`agenda-calendar-layer mt-6 relative overflow-hidden rounded-2xl border transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            useDarkMonthDetailPalette
              ? "border-accent2/35"
              : "border-accent/15"
          }`}
        >
          {selectedBooking && (
            <div
              className={`pointer-events-none absolute z-10 w-[260px] rounded-2xl border px-4 py-3 text-xs shadow-[0_18px_36px_-20px_rgba(0,0,0,0.35)] ${
                useDarkMonthDetailPalette
                  ? "border-accent2/40 bg-bg/95 text-muted shadow-[0_26px_48px_-24px_rgba(0,0,0,0.95)]"
                  : "border-accent/20 bg-bg/95 text-muted"
              }`}
              style={{ left: selectedBooking.x, top: selectedBooking.y }}
            >
              <div className="text-sm font-semibold text-fg">
                {selectedBooking.booking.title}
              </div>
              <div>{selectedBooking.booking.email}</div>
              <div>{selectedBooking.booking.phone}</div>
              <div>{selectedBooking.booking.extrasLabel}</div>
              <div>{selectedBooking.booking.totalLabel}</div>
            </div>
          )}
          <FullCalendar
            key={isMobile ? "agenda-mobile" : "agenda-desktop"}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locales={[esLocale]}
            locale="es"
            initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
            selectable
            longPressDelay={120}
            selectLongPressDelay={120}
            eventLongPressDelay={120}
            select={handleSelect}
            selectAllow={(selectionInfo) => {
              if (!isMonthView) {
                return true;
              }
              return (
                selectionInfo.end.getTime() - selectionInfo.start.getTime() <=
                24 * 60 * 60 * 1000
              );
            }}
            events={combinedEvents}
            displayEventTime={false}
            eventClassNames={(arg) => {
              const props = arg.event.extendedProps as {
                type?: "slot" | "booking" | "month-counter";
                counterKind?: MonthCounterKind;
              };
              if (props.type !== "month-counter") {
                return [];
              }
              return [
                "agenda-month-counter-event",
                props.counterKind === "booked"
                  ? "agenda-month-counter-event--booked"
                  : "agenda-month-counter-event--available",
              ];
            }}
            eventContent={(arg) => {
              const props = arg.event.extendedProps as {
                type?: "slot" | "booking" | "month-counter";
                counterKind?: MonthCounterKind;
                count?: number;
                chipBg?: string;
                chipText?: string;
              };
              if (props.type !== "month-counter") {
                return undefined;
              }
              const count =
                typeof props.count === "number"
                  ? props.count
                  : Number(arg.event.title || 0);
              const counterLabel =
                props.counterKind === "booked" ? "Reservados" : "Disponibles";

              return (
                <span
                  className={`agenda-month-counter-chip ${
                    count === 0 ? "agenda-month-counter-chip--zero" : ""
                  }`}
                  title={`${counterLabel}: ${count}`}
                  style={{
                    backgroundColor: props.chipBg,
                    color: props.chipText,
                  }}
                >
                  {count}
                </span>
              );
            }}
            datesSet={(arg) => {
              const currentStart =
                arg.view.currentStart instanceof Date
                  ? arg.view.currentStart
                  : arg.start;
              const currentEnd =
                arg.view.currentEnd instanceof Date ? arg.view.currentEnd : arg.end;
              const startISO = currentStart.toISOString();
              const endISO = currentEnd.toISOString();
              setCalendarDateRowLabel(arg.view.title);

              setSelectedBooking((prev) => (prev ? null : prev));
              setAvailabilityView((prev) =>
                prev === arg.view.type ? prev : arg.view.type
              );
              setVisibleRange((prev) => {
                if (prev && prev.startISO === startISO && prev.endISO === endISO) {
                  return prev;
                }
                return {
                  startISO,
                  endISO,
                };
              });
            }}
            dateClick={() => {
              setSelectedBooking(null);
              setMonthDetailDayKey(null);
            }}
            eventClick={(info) => {
              const props = info.event.extendedProps as {
                type?: "slot" | "booking" | "month-counter";
                dayKey?: string;
                counterKind?: MonthCounterKind;
                count?: number;
                status?: SlotStatus;
              } & Partial<BookingItem>;

              if (props.type === "month-counter") {
                const dayKey = props.dayKey || getDateKey(info.event.startStr);
                setSelectedBooking(null);
                setMonthDetailDayKey(dayKey);
                return;
              }

              if (props.type === "booking") {
                const booking = props as BookingItem;
                openBookingPopover(booking, info.el, info.jsEvent);
                void removeOverlappingAvailableSlots(booking);
                return;
              }

              setMonthDetailDayKey(null);
              setSelectedBooking(null);
              if (props.type !== "slot" || !props.status) {
                return;
              }

              if (props.status !== "available") {
                return;
              }

              if (!info.event.id) {
                showToast("error", "No se pudo identificar el horario.");
                return;
              }

              void handleDeleteSlot(info.event.id);
            }}
            customButtons={{
              clearVisible: {
                text: "Borrar",
                click: requestClearVisibleRange,
              },
              helpGuide: {
                text: "?",
                hint: "Abrir ayuda de agenda",
                click: () => setShowHelpGuide(true),
              },
            }}
            headerToolbar={{
              left: "prev,today,next",
              center: "clearVisible",
              right: rightToolbarButtons,
            }}
            slotMinTime={activeWindow.slotMin}
            slotMaxTime={activeWindow.slotMax}
            scrollTime={activeWindow.scroll}
            slotDuration="01:00:00"
            slotLabelInterval="01:00:00"
            slotLabelFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              omitZeroMinute: false,
              meridiem: false,
            }}
            height="auto"
            nowIndicator
            allDaySlot={false}
          />
        </div>

      </section>
    </div>
  );
}

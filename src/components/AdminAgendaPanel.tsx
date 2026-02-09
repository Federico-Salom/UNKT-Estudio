"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import { BOOKING_TIMEZONE } from "@/lib/booking";

type SlotStatus = "available" | "blocked" | "booked";

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

type VisibleRange = {
  startISO: string;
  endISO: string;
};

type AdminAgendaPanelProps = {
  slots: SlotItem[];
  bookings: BookingItem[];
};

type ToastStatus = "idle" | "saving" | "saved" | "error";
type TimeWindowMode = "day" | "night";

const timeWindowConfig: Record<
  TimeWindowMode,
  { slotMin: string; slotMax: string; scroll: string; label: string; hint: string }
> = {
  day: {
    slotMin: "07:00:00",
    slotMax: "19:00:00",
    scroll: "07:00:00",
    label: "Modo dia",
    hint: "07:00 a 19:00",
  },
  night: {
    slotMin: "19:00:00",
    slotMax: "31:00:00",
    scroll: "19:00:00",
    label: "Modo noche",
    hint: "19:00 a 07:00",
  },
};

const slotStatusLabels: Record<SlotStatus, string> = {
  available: "Disponible",
  blocked: "Bloqueado",
  booked: "Reservado",
};

const slotColors: Record<SlotStatus, { bg: string; text: string }> = {
  available: { bg: "#8b0d5a", text: "#f7efe0" },
  blocked: { bg: "#e8dccb", text: "#6e5a4a" },
  booked: { bg: "#6e5a4a", text: "#f7efe0" },
};

const nightSlotColors: Record<SlotStatus, { bg: string; text: string }> = {
  available: { bg: "#ff4bb3", text: "#1a1020" },
  blocked: { bg: "#f3cde6", text: "#32143a" },
  booked: { bg: "#7a3f95", text: "#fdf1fb" },
};

const bookingColors: Record<string, { bg: string; text: string }> = {
  paid: { bg: "#8b0d5a", text: "#f7efe0" },
  pending_payment: { bg: "#b01374", text: "#f7efe0" },
};

const nightBookingColors: Record<string, { bg: string; text: string }> = {
  paid: { bg: "#ff4bb3", text: "#190f20" },
  pending_payment: { bg: "#d975ff", text: "#2e1038" },
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
    return "Todo el día";
  }
  return `${startTime} - ${endTime}`;
};

export default function AdminAgendaPanel({
  slots,
  bookings,
}: AdminAgendaPanelProps) {
  const router = useRouter();
  const calendarContainerRef = useRef<HTMLDivElement | null>(null);
  const [localSlots, setLocalSlots] = useState<SlotItem[]>(slots);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingPopover | null>(
    null
  );
  const [availabilityView, setAvailabilityView] = useState("timeGridWeek");
  const [timeWindowMode, setTimeWindowMode] = useState<TimeWindowMode>("day");
  const [visibleRange, setVisibleRange] = useState<VisibleRange | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [status, setStatus] = useState<ToastStatus>("idle");
  const [message, setMessage] = useState("");
  const hideTimer = useRef<number | null>(null);
  const isMonthView = availabilityView === "dayGridMonth";
  const effectiveTimeWindowMode: TimeWindowMode = isMonthView
    ? "day"
    : timeWindowMode;
  const isNight = effectiveTimeWindowMode === "night";
  const activeSlotColors = isNight ? nightSlotColors : slotColors;
  const activeBookingColors = isNight ? nightBookingColors : bookingColors;
  const activeWindow = timeWindowConfig[effectiveTimeWindowMode];

  useEffect(() => {
    setLocalSlots(slots);
  }, [slots]);

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

  const getClearButtonLabel = () => {
    if (availabilityView.includes("Week")) return "Limpiar semana";
    if (availabilityView.includes("Day")) return "Limpiar dia";
    return "Limpiar mes";
  };

  const getClearScopeDescription = () => {
    if (availabilityView.includes("Week")) {
      return effectiveTimeWindowMode === "night"
        ? "la franja Noche de la semana visible (19:00 a 07:00)"
        : "la franja Dia de la semana visible (07:00 a 19:00)";
    }
    if (availabilityView.includes("Day")) {
      return effectiveTimeWindowMode === "night"
        ? "la franja Noche del dia visible (19:00 a 07:00)"
        : "la franja Dia del dia visible (07:00 a 19:00)";
    }
    return "todo el mes visible";
  };

  const requestClearVisibleRange = () => {
    if (!visibleRange || status === "saving") return;
    setSelectedBooking(null);
    setShowClearConfirm(true);
  };

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

  const availabilityEvents = useMemo(() => {
    if (availabilityView.startsWith("dayGrid")) {
      const grouped = new Map<string, Map<SlotStatus, SlotItem[]>>();
      localSlots.forEach((slot) => {
        const dateKey = getDateKey(slot.start);
        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, new Map());
        }
        const statusGroup = grouped.get(dateKey)!;
        const list = statusGroup.get(slot.status) ?? [];
        list.push(slot);
        statusGroup.set(slot.status, list);
      });

      const summaryEvents: {
        id: string;
        title: string;
        start: string;
        allDay: boolean;
        backgroundColor: string;
        borderColor: string;
        textColor: string;
        extendedProps: {
          dayKey: string;
          status: SlotStatus;
          isSummary: true;
          type: "slot";
        };
      }[] = [];

      grouped.forEach((statusMap, dateKey) => {
        statusMap.forEach((daySlots, statusKey) => {
          const sorted = [...daySlots].sort(
            (a, b) =>
              new Date(a.start).getTime() - new Date(b.start).getTime()
          );
          const start = sorted[0]?.start;
          const end = sorted[sorted.length - 1]?.end;
          if (!start || !end) return;
          const rangeLabel = formatRangeLabel(start, end);
          const title =
            rangeLabel === "Todo el día"
              ? `Todo el día · ${slotStatusLabels[statusKey]}`
              : `${rangeLabel} · ${slotStatusLabels[statusKey]}`;

          summaryEvents.push({
            id: `${dateKey}-${statusKey}`,
            title,
            start: dateKey,
            allDay: true,
            backgroundColor: activeSlotColors[statusKey].bg,
            borderColor: activeSlotColors[statusKey].bg,
            textColor: activeSlotColors[statusKey].text,
            extendedProps: {
              dayKey: dateKey,
              status: statusKey,
              isSummary: true,
              type: "slot",
            },
          });
        });
      });

      return summaryEvents;
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
        isSummary: false,
        type: "slot",
      },
    }));
  }, [availabilityView, localSlots, activeSlotColors]);

  const bookingEvents = useMemo(() => {
    if (availabilityView.startsWith("dayGrid")) {
      const grouped = new Map<string, BookingItem[]>();
      bookings.forEach((booking) => {
        const dateKey = getDateKey(booking.start);
        const list = grouped.get(dateKey) ?? [];
        list.push(booking);
        grouped.set(dateKey, list);
      });

      return Array.from(grouped.entries()).map(([dateKey, items]) => {
        const sorted = [...items].sort(
          (a, b) =>
            new Date(a.start).getTime() - new Date(b.start).getTime()
        );
        const start = sorted[0]?.start;
        const end = sorted[sorted.length - 1]?.end;
        const rangeLabel = start && end ? formatRangeLabel(start, end) : "";
        const title = rangeLabel
          ? `Reservas · ${rangeLabel} (${items.length})`
          : `Reservas · ${items.length}`;
        const summaryPalette = isNight
          ? { bg: "#d975ff", text: "#2e1038" }
          : { bg: "#6e5a4a", text: "#f7efe0" };
        return {
          id: `booking-${dateKey}`,
          title,
          start: dateKey,
          allDay: true,
          backgroundColor: summaryPalette.bg,
          borderColor: summaryPalette.bg,
          textColor: summaryPalette.text,
          extendedProps: { isSummary: true, dayKey: dateKey, type: "booking" },
        };
      });
    }

    return bookings.map((booking) => {
      const palette = activeBookingColors[booking.status]
        || (isNight
          ? { bg: "#d975ff", text: "#2e1038" }
          : { bg: "#6e5a4a", text: "#f7efe0" });
      return {
        id: booking.id,
        title: booking.title,
        start: booking.start,
        end: booking.end,
        backgroundColor: palette.bg,
        borderColor: palette.bg,
        textColor: palette.text,
        extendedProps: { ...booking, isSummary: false, type: "booking" },
      };
    });
  }, [availabilityView, bookings, activeBookingColors, isNight]);

  const combinedEvents = useMemo(
    () => [...availabilityEvents, ...bookingEvents],
    [availabilityEvents, bookingEvents]
  );

  const handleSelect = async (selection: {
    startStr: string;
    endStr: string;
  }) => {
    setSelectedBooking(null);

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
          startISO: selection.startStr,
          endISO: selection.endStr,
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
      showToast("saved", "Horarios agregados como bloqueados.");
      router.refresh();
    } catch {
      showToast("error", "No se pudieron agregar horarios.");
    }
  };

  const handleSlotClick = async (slotId: string, currentStatus: SlotStatus) => {
    if (currentStatus === "booked") {
      showToast("error", "Ese horario ya está reservado.");
      return;
    }
    const nextStatus = currentStatus === "available" ? "blocked" : "available";

    try {
      const response = await fetch("/api/admin/availability", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ slotId, status: nextStatus }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast("error", data.error || "No se pudo actualizar.");
        return;
      }
      setLocalSlots((prev) =>
        prev.map((slot) =>
          slot.id === slotId ? { ...slot, status: nextStatus } : slot
        )
      );
      showToast("saved", "Horario actualizado.");
    } catch {
      showToast("error", "No se pudo actualizar.");
    }
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
              isNight
                ? "border-[#f08be1]/45 bg-[#190f24]/96 text-[#fdf2fb]"
                : "border-accent/25 bg-white text-fg"
            }`}
          >
            <h3
              id="clear-confirm-title"
              className={`text-sm font-semibold uppercase tracking-wide ${
                isNight ? "text-[#fdf2fb]" : "text-fg"
              }`}
            >
              Confirmar limpieza
            </h3>
            <p
              id="clear-confirm-description"
              className={`mt-2 text-sm leading-relaxed ${
                isNight ? "text-[#f0dff2]/90" : "text-muted"
              }`}
            >
              Vas a borrar {getClearScopeDescription()}. Solo se eliminan horarios
              disponibles y bloqueados.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className={`rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-wide transition ${
                  isNight
                    ? "border-[#df7ed5]/55 bg-white/8 text-[#fdf2fb] hover:bg-white/14"
                    : "border-accent/30 bg-bg text-muted hover:border-accent/50 hover:bg-accent/5"
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearVisibleRange}
                className={`rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-wide transition ${
                  isNight
                    ? "border-[#ffc1ec]/70 bg-[#ffb3e3] text-[#2f1138] hover:bg-[#ffc8ef]"
                    : "border-accent/35 bg-accent text-bg hover:bg-accent2"
                }`}
              >
                Confirmar
              </button>
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
        className={`agenda-panel rounded-3xl border p-8 backdrop-blur transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isNight
            ? "agenda-panel--night border-[#b45ed7]/35 bg-[#120a1d]/90 text-[#fdf2fb] shadow-[0_40px_90px_-55px_rgba(0,0,0,0.95)]"
            : "border-accent/20 bg-white/70 text-fg shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1
              className={`font-display text-3xl tracking-[0.08em] ${
                isNight
                  ? "text-white drop-shadow-[0_0_18px_rgba(255,102,206,0.45)] transition-colors duration-500"
                  : "text-fg transition-colors duration-500"
              }`}
            >
              Disponibilidad
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            {!isMonthView && (
              <button
                type="button"
                onClick={() =>
                  setTimeWindowMode((prev) => (prev === "day" ? "night" : "day"))
                }
                className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-wide transition-all duration-500 ease-out ${
                  isNight
                    ? "border-[#ffc1ec]/70 bg-[#ffb3e3] text-[#2f1138] shadow-[0_0_22px_-8px_rgba(255,124,220,0.95)] hover:bg-[#ffc8ef]"
                    : "border-accent/35 bg-accent text-bg shadow-[0_10px_20px_-14px_rgba(139,13,90,0.9)] hover:bg-accent2"
                }`}
                aria-pressed={isNight}
              >
                {isNight ? "Noche" : "Dia"}
              </button>
            )}
          </div>
        </div>

        <div
          ref={calendarContainerRef}
          className={`agenda-calendar mt-6 relative overflow-hidden rounded-2xl border p-3 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isNight
              ? "agenda-calendar--night border-[#c970ea]/25 bg-[#10081a]/85"
              : "agenda-calendar--day border-accent/15 bg-white/80"
          }`}
        >
          {selectedBooking && (
            <div
              className={`pointer-events-none absolute z-10 w-[260px] rounded-2xl border px-4 py-3 text-xs shadow-[0_18px_36px_-20px_rgba(0,0,0,0.35)] ${
                isNight
                  ? "border-[#de83dc]/45 bg-[#1a0f28]/95 text-[#f3e4f5] shadow-[0_26px_48px_-24px_rgba(0,0,0,0.95)]"
                  : "border-accent/20 bg-bg/95 text-muted"
              }`}
              style={{ left: selectedBooking.x, top: selectedBooking.y }}
            >
              <div className={`text-sm font-semibold ${isNight ? "text-white" : "text-fg"}`}>
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
            events={combinedEvents}
            displayEventTime={false}
            datesSet={(arg) => {
              const currentStart =
                arg.view.currentStart instanceof Date
                  ? arg.view.currentStart
                  : arg.start;
              const currentEnd =
                arg.view.currentEnd instanceof Date ? arg.view.currentEnd : arg.end;
              const startISO = currentStart.toISOString();
              const endISO = currentEnd.toISOString();

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
            }}
            eventClick={(info) => {
              const props = info.event.extendedProps as {
                type?: "slot" | "booking";
                dayKey?: string;
                isSummary?: boolean;
                status?: SlotStatus;
              } & Partial<BookingItem>;
              if (props.type === "booking") {
                if (props.isSummary) {
                  const dayKey =
                    props.dayKey || getDateKey(info.event.startStr);
                  const bookingForDay = bookings
                    .filter(
                      (booking) => getDateKey(booking.start) === dayKey
                    )
                    .sort(
                      (a, b) =>
                        new Date(a.start).getTime() -
                        new Date(b.start).getTime()
                    )[0];
                  if (bookingForDay) {
                    openBookingPopover(bookingForDay, info.el, info.jsEvent);
                  }
                  return;
                }
                openBookingPopover(props as BookingItem, info.el, info.jsEvent);
                return;
              }

              setSelectedBooking(null);
              if (availabilityView !== "timeGridDay" || !props.status) {
                return;
              }
              handleSlotClick(info.event.id, props.status as SlotStatus);
            }}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: isMobile
                ? "dayGridMonth,timeGridDay"
                : "dayGridMonth,timeGridWeek,timeGridDay",
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

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={requestClearVisibleRange}
            disabled={!visibleRange || status === "saving"}
            className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isNight
                ? "border-[#d87fdc]/55 bg-white/8 text-[#fdf2fb] hover:border-[#f1b8eb] hover:bg-white/14"
                : "border-accent/35 bg-accent/10 text-accent hover:border-accent hover:bg-accent/20"
            }`}
          >
            {getClearButtonLabel()}
          </button>
        </div>

        <div
          className={`mt-4 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide transition-colors duration-500 ${
            isNight ? "text-[#f3e4f5]" : "text-muted"
          }`}
        >
          <span className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: activeSlotColors.available.bg }}
            />
            Disponible
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: activeSlotColors.blocked.bg }}
            />
            Bloqueado
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: activeSlotColors.booked.bg }}
            />
            Reservado
          </span>
        </div>
      </section>
    </div>
  );
}




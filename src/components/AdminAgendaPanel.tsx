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

type AdminAgendaPanelProps = {
  slots: SlotItem[];
  bookings: BookingItem[];
};

type ToastStatus = "idle" | "saving" | "saved" | "error";

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

const bookingColors: Record<string, { bg: string; text: string }> = {
  paid: { bg: "#8b0d5a", text: "#f7efe0" },
  pending_payment: { bg: "#b01374", text: "#f7efe0" },
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
  const [localSlots, setLocalSlots] = useState<SlotItem[]>(slots);
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(
    null
  );
  const [availabilityView, setAvailabilityView] = useState("timeGridWeek");
  const [status, setStatus] = useState<ToastStatus>("idle");
  const [message, setMessage] = useState("");
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingSlots, setEditingSlots] = useState<SlotItem[]>([]);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("10:00");
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("09:00");
  const [editEnd, setEditEnd] = useState("10:00");
  const [modalError, setModalError] = useState("");
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    setLocalSlots(slots);
  }, [slots]);

  useEffect(() => {
    if (!editingDate) return;
    const daySlots = localSlots
      .filter((slot) => getDateKey(slot.start) === editingDate)
      .sort(
        (a, b) =>
          new Date(a.start).getTime() - new Date(b.start).getTime()
      );
    setEditingSlots(daySlots);
  }, [editingDate, localSlots]);

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

  const openDayEditor = (dateKey: string) => {
    setEditingDate(dateKey);
    setModalError("");
    setEditingSlotId(null);
    setNewStart("09:00");
    setNewEnd("10:00");
  };

  const closeDayEditor = () => {
    setEditingDate(null);
    setEditingSlotId(null);
    setModalError("");
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
            backgroundColor: slotColors[statusKey].bg,
            borderColor: slotColors[statusKey].bg,
            textColor: slotColors[statusKey].text,
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
      backgroundColor: slotColors[slot.status].bg,
      borderColor: slotColors[slot.status].bg,
      textColor: slotColors[slot.status].text,
      extendedProps: {
        status: slot.status,
        dayKey: getDateKey(slot.start),
        isSummary: false,
        type: "slot",
      },
    }));
  }, [availabilityView, localSlots]);

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
        return {
          id: `booking-${dateKey}`,
          title,
          start: dateKey,
          allDay: true,
          backgroundColor: "#6e5a4a",
          borderColor: "#6e5a4a",
          textColor: "#f7efe0",
          extendedProps: { isSummary: true, dayKey: dateKey, type: "booking" },
        };
      });
    }

    return bookings.map((booking) => {
      const palette = bookingColors[booking.status] || {
        bg: "#6e5a4a",
        text: "#f7efe0",
      };
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
  }, [availabilityView, bookings]);

  const combinedEvents = useMemo(
    () => [...availabilityEvents, ...bookingEvents],
    [availabilityEvents, bookingEvents]
  );

  const handleSelect = async (selection: {
    startStr: string;
    endStr: string;
    view: { type: string };
  }) => {
    if (selection.view.type.startsWith("dayGrid")) {
      openDayEditor(getDateKey(selection.startStr));
      return;
    }

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
      showToast("saved", "Horarios agregados.");
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

  const handleAddRange = async () => {
    if (!editingDate) return;
    setModalError("");
    if (!newStart || !newEnd) {
      setModalError("Completa el rango horario.");
      return;
    }
    if (newEnd <= newStart) {
      setModalError("El horario final debe ser mayor al inicial.");
      return;
    }

    try {
      const response = await fetch("/api/admin/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ date: editingDate, start: newStart, end: newEnd }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setModalError(data.error || "No se pudieron agregar horarios.");
        return;
      }
      showToast("saved", "Horarios agregados.");
      router.refresh();
    } catch {
      setModalError("No se pudieron agregar horarios.");
    }
  };

  const handleStartEdit = (slot: SlotItem) => {
    setEditingSlotId(slot.id);
    setEditStart(formatTime(slot.start));
    setEditEnd(formatTime(slot.end));
    setModalError("");
  };

  const handleSaveEdit = async () => {
    if (!editingDate || !editingSlotId) return;
    setModalError("");
    if (!editStart || !editEnd) {
      setModalError("Completa el horario.");
      return;
    }
    if (editEnd <= editStart) {
      setModalError("El horario final debe ser mayor al inicial.");
      return;
    }

    try {
      const response = await fetch("/api/admin/availability", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          slotId: editingSlotId,
          date: editingDate,
          start: editStart,
          end: editEnd,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setModalError(data.error || "No se pudo actualizar el horario.");
        return;
      }
      setEditingSlotId(null);
      showToast("saved", "Horario actualizado.");
      router.refresh();
    } catch {
      setModalError("No se pudo actualizar el horario.");
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
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
        setModalError(data.error || "No se pudo eliminar el horario.");
        return;
      }
      showToast("saved", "Horario eliminado.");
      router.refresh();
    } catch {
      setModalError("No se pudo eliminar el horario.");
    }
  };

  const formattedEditingDate = editingDate
    ? humanDateFormatter.format(new Date(`${editingDate}T00:00:00`))
    : "";

  return (
    <div className="grid gap-10">
      <section className="rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl uppercase tracking-[0.2em]">
              Disponibilidad
            </h1>
            <p className="mt-2 text-sm text-muted">
              Seleccioná un rango para agregar horarios. Click en un día para
              editarlo.
            </p>
          </div>
          {status !== "idle" && (
            <div
              className={`rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-wide ${
                status === "saved"
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : status === "saving"
                    ? "border-accent/20 bg-bg text-muted"
                    : "border-accent/40 bg-accent/10 text-accent"
              }`}
              role="status"
            >
              {message}
            </div>
          )}
        </div>

        <div className="mt-6 relative overflow-hidden rounded-2xl border border-accent/15 bg-white/80 p-3">
          {selectedBooking && (
            <div className="absolute right-4 top-4 z-10 max-w-[260px] rounded-2xl border border-accent/20 bg-bg/95 px-4 py-3 text-xs text-muted shadow-[0_18px_36px_-20px_rgba(0,0,0,0.35)]">
              <div className="text-sm font-semibold text-fg">
                {selectedBooking.title}
              </div>
              <div>{selectedBooking.email}</div>
              <div>{selectedBooking.phone}</div>
              <div>{selectedBooking.extrasLabel}</div>
              <div>{selectedBooking.totalLabel}</div>
            </div>
          )}
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locales={[esLocale]}
            locale="es"
            initialView="timeGridWeek"
            selectable
            select={handleSelect}
            events={combinedEvents}
            displayEventTime={false}
            datesSet={(arg) => setAvailabilityView(arg.view.type)}
            dateClick={(arg) => {
              if (arg.view.type.startsWith("dayGrid")) {
                openDayEditor(getDateKey(arg.dateStr));
              }
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
                    setSelectedBooking(bookingForDay);
                  }
                  return;
                }
                setSelectedBooking(props as BookingItem);
                return;
              }

              const dayKey = props.dayKey || getDateKey(info.event.startStr);
              if (availabilityView.startsWith("dayGrid")) {
                openDayEditor(dayKey);
                return;
              }
              handleSlotClick(info.event.id, props.status as SlotStatus);
            }}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            height="auto"
            nowIndicator
            allDaySlot={false}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: slotColors.available.bg }}
            />
            Disponible
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: slotColors.blocked.bg }}
            />
            Bloqueado
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: slotColors.booked.bg }}
            />
            Reservado
          </span>
        </div>
      </section>

      {editingDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            className="absolute inset-0 bg-black/30"
            onClick={closeDayEditor}
            aria-label="Cerrar"
            type="button"
          />
          <div className="relative w-full max-w-2xl rounded-3xl border border-accent/20 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl uppercase tracking-[0.2em]">
                  Editar disponibilidad
                </h3>
                <p className="mt-1 text-sm text-muted">{formattedEditingDate}</p>
              </div>
              <button
                className="rounded-full border border-accent/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
                onClick={closeDayEditor}
                type="button"
              >
                Cerrar
              </button>
            </div>

            {modalError && (
              <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                {modalError}
              </div>
            )}

            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-accent/15 bg-bg/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Agregar horario
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Desde
                    <input
                      className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm text-fg outline-none transition focus:border-accent"
                      type="time"
                      value={newStart}
                      onChange={(event) => setNewStart(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Hasta
                    <input
                      className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm text-fg outline-none transition focus:border-accent"
                      type="time"
                      value={newEnd}
                      onChange={(event) => setNewEnd(event.target.value)}
                    />
                  </label>
                  <button
                    className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-xs font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2"
                    type="button"
                    onClick={handleAddRange}
                  >
                    Agregar
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                {editingSlots.length === 0 ? (
                  <div className="rounded-2xl border border-accent/15 bg-bg/80 px-4 py-3 text-sm text-muted">
                    No hay horarios cargados para este día.
                  </div>
                ) : (
                  editingSlots.map((slot) => {
                    const statusLabel = slotStatusLabels[slot.status];
                    const rangeLabel = formatRangeLabel(slot.start, slot.end);
                    const isEditing = editingSlotId === slot.id;
                    return (
                      <div
                        key={slot.id}
                        className="rounded-2xl border border-accent/15 bg-white/80 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">
                              {rangeLabel}
                            </div>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                              {statusLabel}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              className="rounded-full border border-accent/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                              type="button"
                              onClick={() =>
                                handleSlotClick(slot.id, slot.status)
                              }
                              disabled={slot.status === "booked"}
                            >
                              {slot.status === "available"
                                ? "Bloquear"
                                : slot.status === "blocked"
                                  ? "Habilitar"
                                  : "Reservado"}
                            </button>
                            <button
                              className="rounded-full border border-accent/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                              type="button"
                              onClick={() => handleStartEdit(slot)}
                              disabled={slot.status === "booked"}
                            >
                              Editar
                            </button>
                            <button
                              className="rounded-full border border-accent/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                              type="button"
                              onClick={() => handleDeleteSlot(slot.id)}
                              disabled={slot.status === "booked"}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>

                        {isEditing && (
                          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                            <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                              Desde
                              <input
                                className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm text-fg outline-none transition focus:border-accent"
                                type="time"
                                value={editStart}
                                onChange={(event) =>
                                  setEditStart(event.target.value)
                                }
                              />
                            </label>
                            <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                              Hasta
                              <input
                                className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm text-fg outline-none transition focus:border-accent"
                                type="time"
                                value={editEnd}
                                onChange={(event) =>
                                  setEditEnd(event.target.value)
                                }
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="rounded-full bg-accent px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2"
                                type="button"
                                onClick={handleSaveEdit}
                              >
                                Guardar
                              </button>
                              <button
                                className="rounded-full border border-accent/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
                                type="button"
                                onClick={() => setEditingSlotId(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

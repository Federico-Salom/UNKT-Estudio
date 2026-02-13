import { redirect } from "next/navigation";
import Header from "@/components/Header";
import BookingForm from "@/components/BookingForm";
import { getAvailabilityCutoffDate } from "@/lib/availability";
import { getSessionFromCookies } from "@/lib/auth";
import {
  BOOKING_TIMEZONE,
  normalizeExtraBackgrounds,
  resolveBasePrice,
  resolveExtraMaxSelections,
} from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

type ReservarPageProps = {
  searchParams?: Promise<{
    editBookingId?: string | string[];
    editSection?: string | string[];
  }>;
};

const getFirstParamValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const parseStringArray = (value: string) => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    return [];
  }
};

const getBookingSlotIds = (slotIdsValue: string, slotId: string | null) => {
  const parsed = parseStringArray(slotIdsValue);
  if (parsed.length) {
    return Array.from(new Set(parsed));
  }
  if (slotId) {
    return [slotId];
  }
  return [];
};

const getEditSection = (value: string | undefined) => {
  if (value === "horario") return "horario" as const;
  if (value === "extras") return "extras" as const;
  return null;
};

const hasValidName = (value: string) =>
  /^[\p{L}\s'-]+$/u.test(value.trim()) &&
  (value.trim().match(/\p{L}/gu) ?? []).length >= 2;

const hasValidPhone = (value: string) => {
  const digitsCount = value.replace(/\D/g, "").length;
  return digitsCount >= 7 && digitsCount <= 15;
};

const bookingDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BOOKING_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type BookingSlotRecord = {
  id: string;
  start: Date;
  end: Date;
  status: string;
};

const getBookableAvailableSlotIds = (slots: BookingSlotRecord[]) => {
  const slotsByDate = new Map<string, BookingSlotRecord[]>();

  slots.forEach((slot) => {
    if (slot.status !== "available") return;
    const dateKey = bookingDateKeyFormatter.format(slot.start);
    const dateSlots = slotsByDate.get(dateKey) ?? [];
    dateSlots.push(slot);
    slotsByDate.set(dateKey, dateSlots);
  });

  const bookableSlotIds = new Set<string>();

  slotsByDate.forEach((dateSlots) => {
    const sortedSlots = [...dateSlots].sort(
      (slotA, slotB) => slotA.start.getTime() - slotB.start.getTime()
    );

    sortedSlots.forEach((slot, index) => {
      const previousSlot = sortedSlots[index - 1];
      const nextSlot = sortedSlots[index + 1];

      const hasPreviousConsecutiveSlot = Boolean(
        previousSlot && previousSlot.end.getTime() === slot.start.getTime()
      );
      const hasNextConsecutiveSlot = Boolean(
        nextSlot && slot.end.getTime() === nextSlot.start.getTime()
      );

      if (hasPreviousConsecutiveSlot || hasNextConsecutiveSlot) {
        bookableSlotIds.add(slot.id);
      }
    });
  });

  return bookableSlotIds;
};

const filterVisibleBookingSlots = (
  slots: BookingSlotRecord[],
  forcedSlotIds: string[]
) => {
  const forcedSlotIdSet = new Set(forcedSlotIds);
  const bookableAvailableSlotIds = getBookableAvailableSlotIds(slots);

  return slots.filter(
    (slot) =>
      forcedSlotIdSet.has(slot.id) ||
      (slot.status === "available" && bookableAvailableSlotIds.has(slot.id))
  );
};

export default async function ReservarPage({ searchParams }: ReservarPageProps) {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const editBookingId = getFirstParamValue(
    resolvedSearchParams?.editBookingId
  )?.trim();
  const editSection = getEditSection(
    getFirstParamValue(resolvedSearchParams?.editSection)
      ?.trim()
      ?.toLowerCase()
  );

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      phone: true,
      bookingContactVerified: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const editingBooking = editBookingId
    ? await prisma.booking.findUnique({
        where: { id: editBookingId },
        select: {
          id: true,
          userId: true,
          slotIds: true,
          slotId: true,
          extras: true,
          status: true,
        },
      })
    : null;

  if (editBookingId && !editingBooking) {
    redirect("/mis-reservas");
  }

  if (editingBooking) {
    const canEdit =
      session.role === "admin" || editingBooking.userId === session.userId;
    if (!canEdit) {
      redirect("/account");
    }
    if (editingBooking.status !== "pending_payment") {
      redirect(`/checkout?bookingId=${editingBooking.id}`);
    }
  }

  const studio = await getStudioContent();
  const basePrice = resolveBasePrice(studio.pricing.basePrice);
  const extraBackgrounds = normalizeExtraBackgrounds(studio.extras.backgrounds);
  const maxExtraSelections = resolveExtraMaxSelections(studio.extras.maxSelections);
  const cutoff = getAvailabilityCutoffDate();
  const editSlotIds = editingBooking
    ? getBookingSlotIds(editingBooking.slotIds, editingBooking.slotId)
    : [];

  const slots = await prisma.availabilitySlot.findMany({
    where: editSlotIds.length
      ? {
          OR: [
            {
              status: "available",
              start: { gt: cutoff },
            },
            {
              id: { in: editSlotIds },
            },
          ],
        }
      : {
          status: "available",
          start: { gt: cutoff },
        },
    orderBy: { start: "asc" },
  });

  const visibleSlots = filterVisibleBookingSlots(slots, editSlotIds);

  const slotOptions = visibleSlots.map((slot) => ({
    id: slot.id,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
  }));

  const profileName = user.name?.trim() ?? "";
  const profilePhone = user.phone?.trim() ?? "";
  const isContactVerified = Boolean(
    (user.bookingContactVerified || (profileName && profilePhone)) &&
      hasValidName(profileName) &&
      hasValidPhone(profilePhone)
  );

  return (
    <div className="booking-page min-h-screen bg-bg text-fg">
      <Header studio={studio} />

      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-3 py-10 sm:px-6 sm:py-16">
        <div className="booking-card w-full min-w-0 max-w-2xl rounded-3xl border border-accent/20 bg-white/70 p-4 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur sm:p-8">
          {slotOptions.length === 0 && (
            <div
              className="booking-note mt-6 rounded-2xl border border-accent/20 bg-bg px-4 py-3 text-sm"
              role="status"
            >
              No hay horarios disponibles. Vuelve mas tarde o consulta por
              WhatsApp.
            </div>
          )}

          <BookingForm
            slots={slotOptions}
            extraBackgrounds={extraBackgrounds}
            maxExtraSelections={maxExtraSelections}
            basePrice={basePrice}
            policies={studio.footer.policies}
            profileName={profileName}
            profilePhone={profilePhone}
            isContactVerified={isContactVerified}
            editBookingId={editingBooking?.id}
            editSection={editSection}
            initialSelectedSlotIds={editSlotIds}
            initialSelectedExtras={
              editingBooking ? parseStringArray(editingBooking.extras) : []
            }
            pageTitle={editingBooking ? "Editar reserva" : "Agendar sesion"}
          />
        </div>
      </main>
    </div>
  );
}

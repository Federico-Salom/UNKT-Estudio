import { redirect } from "next/navigation";
import Header from "@/components/Header";
import BookingForm from "@/components/BookingForm";
import { getSessionFromCookies } from "@/lib/auth";
import {
  normalizeExtraBackgrounds,
  resolveBasePrice,
  resolveExtraMaxSelections,
} from "@/lib/booking";
import { getAvailabilityCutoffDate } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";
const hasValidName = (value: string) =>
  /^[\p{L}\s'-]+$/u.test(value.trim()) &&
  (value.trim().match(/\p{L}/gu) ?? []).length >= 2;
const hasValidPhone = (value: string) => {
  const digitsCount = value.replace(/\D/g, "").length;
  return digitsCount >= 7 && digitsCount <= 15;
};

export default async function ReservarPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

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

  const studio = await getStudioContent();
  const basePrice = resolveBasePrice(studio.pricing.basePrice);
  const extraBackgrounds = normalizeExtraBackgrounds(studio.extras.backgrounds);
  const maxExtraSelections = resolveExtraMaxSelections(studio.extras.maxSelections);
  const cutoff = getAvailabilityCutoffDate();

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      status: "available",
      start: { gt: cutoff },
    },
    orderBy: { start: "asc" },
  });

  const slotOptions = slots.map((slot) => ({
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

      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-6 py-16">
        <div className="booking-card w-full max-w-2xl rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
          <h1 className="font-display text-3xl uppercase tracking-[0.2em]">
            Agendar sesión
          </h1>
          <p className="mt-2 text-sm text-muted">
            Reserva por hora y confirma el pago.
          </p>
          {slotOptions.length === 0 && (
            <div
              className="booking-note mt-6 rounded-2xl border border-accent/20 bg-bg px-4 py-3 text-sm"
              role="status"
            >
              No hay horarios disponibles. Vuelve más tarde o consulta por
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
          />
        </div>
      </main>
    </div>
  );
}

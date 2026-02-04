"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudioContent } from "@/content/studio";

type GalleryItem = {
  src: string;
  alt: string;
};

type AdminContentFormProps = {
  studio: StudioContent;
  gallery: GalleryItem[];
};

type Status = "idle" | "saving" | "saved" | "error";

const errorMessages: Record<string, string> = {
  unauthorized: "Tu sesión expiró. Inicia sesión nuevamente.",
  forbidden: "No tienes permisos para editar el contenido.",
};

export default function AdminContentForm({
  studio,
  gallery,
}: AdminContentFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [showToast, setShowToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current);
      }
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
    }

    const startedAt = Date.now();
    setErrorMessage("");
    setStatus("saving");
    setShowToast(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/content", {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const serverError =
          typeof data.error === "string"
            ? errorMessages[data.error] || data.error
            : "No se pudo guardar.";
        setErrorMessage(serverError);
        throw new Error("error");
      }

      const elapsed = Date.now() - startedAt;
      if (elapsed < 1000) {
        await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
      }
      setStatus("saved");
      router.refresh();
    } catch {
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1000) {
        await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
      }
      setStatus("error");
    } finally {
      hideTimer.current = window.setTimeout(() => {
        setShowToast(false);
        setStatus("idle");
        setErrorMessage("");
      }, 1600);
    }
  };

  return (
    <form
      className="grid gap-10"
      onSubmit={handleSubmit}
      encType="multipart/form-data"
    >
      <div className="rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
        <h1 className="font-display text-3xl uppercase tracking-[0.2em]">
          Contenido
        </h1>
        <p className="mt-2 text-sm text-muted">
          Edita textos e imágenes principales de la landing.
        </p>

        <div className="mt-8 grid gap-6">
          <label className="grid gap-2 text-sm font-semibold">
            Nombre del estudio
            <input
              className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
              type="text"
              name="name"
              defaultValue={studio.name}
              required
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Título principal
              <input
                className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                type="text"
                name="heroTitle"
                defaultValue={studio.hero.title}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Subtítulo
              <input
                className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                type="text"
                name="heroSubtitle"
                defaultValue={studio.hero.subtitle}
                required
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              CTA principal
              <input
                className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                type="text"
                name="ctaPrimary"
                defaultValue={studio.ctas.primary}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              CTA secundario
              <input
                className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                type="text"
                name="ctaSecondary"
                defaultValue={studio.ctas.secondary}
                required
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              WhatsApp (E.164 sin +)
              <input
                className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                type="text"
                name="whatsappPhone"
                defaultValue={studio.contact.whatsapp.phone}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Mensaje WhatsApp
              <input
                className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                type="text"
                name="whatsappMessage"
                defaultValue={studio.contact.whatsapp.message}
                required
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Correo de contacto
              <input
                className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                type="email"
                name="contactEmail"
                defaultValue={studio.contact.email}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Texto dirección
              <input
                className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                type="text"
                name="locationText"
                defaultValue={studio.contact.locationText}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Link Google Maps
              <input
                className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                type="url"
                name="locationUrl"
                defaultValue={studio.contact.locationUrl}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Horarios
              <input
                className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                type="text"
                name="hours"
                defaultValue={studio.contact.hours}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Título de contacto
              <input
                className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                type="text"
                name="contactTitle"
                defaultValue={studio.contact.title}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Nota de contacto
              <input
                className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                type="text"
                name="contactNote"
                defaultValue={studio.contact.note}
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-semibold">
            Texto del footer
            <input
              className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
              type="text"
              name="footerText"
              defaultValue={studio.footer.text}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-3">
              <label className="grid gap-2 text-sm font-semibold">
                Título incluido
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-4 py-2 text-sm outline-none transition focus:border-accent"
                  type="text"
                  name="includedTitle"
                  defaultValue={studio.included.title}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Subtítulo incluido
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-4 py-2 text-sm outline-none transition focus:border-accent"
                  type="text"
                  name="includedSubtitle"
                  defaultValue={studio.included.subtitle}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Incluido (uno por línea)
                <textarea
                  className="min-h-[120px] rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                  name="includedItems"
                  defaultValue={studio.included.items.join("\n")}
                />
              </label>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-2 text-sm font-semibold">
                Título extras
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-4 py-2 text-sm outline-none transition focus:border-accent"
                  type="text"
                  name="extrasTitle"
                  defaultValue={studio.extras.title}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Subtítulo extras
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-4 py-2 text-sm outline-none transition focus:border-accent"
                  type="text"
                  name="extrasSubtitle"
                  defaultValue={studio.extras.subtitle}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Extras (uno por línea)
                <textarea
                  className="min-h-[120px] rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                  name="extrasItems"
                  defaultValue={studio.extras.items.join("\n")}
                />
              </label>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-2 text-sm font-semibold">
                Título cómo reservar
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-4 py-2 text-sm outline-none transition focus:border-accent"
                  type="text"
                  name="howToBookTitle"
                  defaultValue={studio.howToBook.title}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Pasos (uno por línea)
                <textarea
                  className="min-h-[120px] rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                  name="howToBookSteps"
                  defaultValue={studio.howToBook.steps.join("\n")}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
        <h2 className="font-display text-2xl uppercase tracking-[0.2em]">
          Imágenes
        </h2>
        <p className="mt-2 text-sm text-muted">
          Si no cargas una imagen, se mantiene la actual.
        </p>

        <div className="mt-8 grid gap-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
            <div className="overflow-hidden rounded-2xl border border-accent/20 bg-bg">
              <img
                className="h-full w-full object-cover"
                src={studio.hero.image.src}
                alt={studio.hero.image.alt}
              />
            </div>
            <div className="grid gap-3">
              <label className="grid gap-2 text-sm font-semibold">
                Imagen principal
                <input type="file" name="heroImage" accept="image/*" />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Alt de imagen principal
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                  type="text"
                  name="heroImageAlt"
                  defaultValue={studio.hero.image.alt}
                />
              </label>
            </div>
          </div>

          <div className="grid gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Galería
            </h3>
            <div className="grid gap-6 md:grid-cols-2">
              {gallery.map((item, index) => (
                <div
                  key={`${item.src}-${index}`}
                  className="grid gap-3 rounded-2xl border border-accent/15 bg-white/70 p-4"
                >
                  <div className="overflow-hidden rounded-2xl border border-accent/15 bg-bg">
                    <img
                      className="h-48 w-full object-cover"
                      src={item.src}
                      alt={item.alt}
                    />
                  </div>
                  <label className="grid gap-2 text-sm font-semibold">
                    Reemplazar imagen
                    <input
                      type="file"
                      name={`galleryImage${index}`}
                      accept="image/*"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">
                    Alt
                    <input
                      className="rounded-2xl border border-accent/20 bg-white px-4 py-2 text-sm outline-none transition focus:border-accent"
                      type="text"
                      name={`galleryAlt${index}`}
                      defaultValue={item.alt}
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <button
          className="inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-4 text-sm font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 disabled:cursor-not-allowed disabled:opacity-70"
          type="submit"
          disabled={status === "saving"}
        >
          {status === "saving" ? "Guardando..." : "Guardar cambios"}
        </button>

        <div
          className={`pointer-events-none absolute left-1/2 top-0 z-10 w-[240px] -translate-x-1/2 -translate-y-full transition-all duration-300 ${
            showToast
              ? "translate-y-[-110%] opacity-100"
              : "translate-y-[-90%] opacity-0"
          }`}
        >
          <div
            className={`rounded-2xl border px-4 py-3 text-xs font-semibold uppercase tracking-wide shadow-[0_18px_36px_-20px_rgba(0,0,0,0.35)] ${
              status === "saved"
                ? "border-accent/30 bg-accent/10 text-accent"
                : status === "saving"
                  ? "border-accent/20 bg-bg text-muted"
                  : "border-accent/40 bg-accent/10 text-accent"
            }`}
            role="status"
          >
            {status === "saving" && "Guardando cambios..."}
            {status === "saved" && "Cambios guardados"}
            {status === "error" && (errorMessage || "No se pudo guardar")}
          </div>
        </div>
      </div>
    </form>
  );
}

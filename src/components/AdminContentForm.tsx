"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudioContent } from "@/content/studio";

type GalleryItem = {
  src: string;
  alt: string;
};

type GalleryFormItem = {
  id: string;
  src?: string;
  alt: string;
  file?: File;
  previewUrl?: string;
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
  const [logoFileName, setLogoFileName] = useState("Ningun archivo seleccionado");
  const [wordmarkFileName, setWordmarkFileName] = useState(
    "Ningun archivo seleccionado"
  );
  const [seoOgFileName, setSeoOgFileName] = useState(
    "Ningun archivo seleccionado"
  );
  const [galleryItems, setGalleryItems] = useState<GalleryFormItem[]>(() =>
    gallery.slice(0, 10).map((item, index) => ({
      id: `existing-${index}-${Math.random().toString(36).slice(2, 8)}`,
      src: item.src,
      alt: item.alt,
    }))
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const galleryItemsRef = useRef<GalleryFormItem[]>([]);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    galleryItemsRef.current = galleryItems;
  }, [galleryItems]);

  useEffect(() => {
    return () => {
      galleryItemsRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
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

    const galleryPayload = galleryItems.slice(0, 10).map((item) => ({
      id: item.id,
      src: item.src || "",
      alt: item.alt || "",
    }));
    formData.set("galleryOrder", JSON.stringify(galleryPayload));
    galleryItems.forEach((item) => {
      if (item.file) {
        formData.append(`galleryFile_${item.id}`, item.file);
      }
    });

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

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setLogoFileName(file ? file.name : "Ningun archivo seleccionado");
  };

  const handleWordmarkFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    setWordmarkFileName(file ? file.name : "Ningun archivo seleccionado");
  };

  const handleSeoOgFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSeoOgFileName(file ? file.name : "Ningun archivo seleccionado");
  };

  const handleGalleryUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setGalleryItems((prev) => {
      const remaining = Math.max(0, 10 - prev.length);
      const nextFiles = files.slice(0, remaining);
      const nextItems = nextFiles.map((file) => ({
        id: `new-${Math.random().toString(36).slice(2, 10)}`,
        file,
        alt: "",
        previewUrl: URL.createObjectURL(file),
      }));
      return [...prev, ...nextItems];
    });
    event.target.value = "";
  };

  const handleGalleryAltChange = (id: string, value: string) => {
    setGalleryItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, alt: value } : item))
    );
  };

  const handleRemoveGalleryItem = (id: string) => {
    setGalleryItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleReorder = (from: number, to: number) => {
    if (from === to) return;
    setGalleryItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
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
          Edita textos y contenidos visuales de la landing.
        </p>

        <div className="mt-8 grid gap-6">
          <details
            className="rounded-2xl border border-accent/15 bg-white/80 p-5"
            open
          >
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-fg/80">
              Logo y wordmark
            </summary>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div className="grid gap-3">
                <div className="overflow-hidden rounded-2xl border border-accent/20 bg-bg p-3">
                  <img
                    className="h-20 w-20 rounded-full object-cover"
                    src={studio.logo.src}
                    alt={studio.logo.alt}
                  />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Logo actual (se reemplaza en Marca, SEO y sitio)
                </span>
              </div>
              <div className="grid gap-3">
                <div className="overflow-hidden rounded-2xl border border-accent/20 bg-bg p-3">
                  <img
                    className="h-20 w-full object-contain"
                    src={studio.logo.wordmarkSrc}
                    alt={studio.logo.alt}
                  />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Wordmark actual (se reemplaza en Marca, SEO y sitio)
                </span>
              </div>
            </div>
          </details>

          <details
            className="rounded-2xl border border-accent/15 bg-white/80 p-5"
            open
          >
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-fg/80">
              Identidad y héroe
            </summary>
            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl border border-accent/15 bg-bg/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                La identidad del estudio se maneja desde el logo wordmark.
              </div>
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
            </div>
          </details>

          <details className="rounded-2xl border border-accent/15 bg-white/80 p-5">
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-fg/80">
              Marca, SEO y sitio
            </summary>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">
                  URL del sitio
                  <input
                    className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                    type="url"
                    name="siteUrl"
                    defaultValue={studio.siteUrl}
                    required
                  />
                  <span className="text-xs font-medium text-muted">
                    Ejemplo: https://tudominio.com. Si no pones protocolo, se
                    completa automaticamente.
                  </span>
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Alt del logo
                  <input
                    className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                    type="text"
                    name="logoAlt"
                    defaultValue={studio.logo.alt}
                    required
                  />
                </label>
              </div>
              <div className="rounded-2xl border border-accent/15 bg-bg/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                No hace falta editar rutas manuales. Para cambiar logo, wordmark
                o imagen SEO, sube un archivo y el sistema guarda la ruta solo.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">
                  Reemplazar logo (avatar)
                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      htmlFor="logoImageSeo"
                      className="inline-flex items-center justify-center rounded-full border border-accent/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
                    >
                      Seleccionar imagen
                    </label>
                    <span className="text-xs text-muted">{logoFileName}</span>
                  </div>
                  <input
                    id="logoImageSeo"
                    type="file"
                    name="logoImage"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleLogoFileChange}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Reemplazar wordmark (texto)
                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      htmlFor="wordmarkImageSeo"
                      className="inline-flex items-center justify-center rounded-full border border-accent/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
                    >
                      Seleccionar imagen
                    </label>
                    <span className="text-xs text-muted">{wordmarkFileName}</span>
                  </div>
                  <input
                    id="wordmarkImageSeo"
                    type="file"
                    name="wordmarkImage"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleWordmarkFileChange}
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-semibold">
                SEO title
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                  type="text"
                  name="seoTitle"
                  defaultValue={studio.seo.title}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                SEO description
                <textarea
                  className="min-h-[96px] rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                  name="seoDescription"
                  defaultValue={studio.seo.description}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Imagen para compartir (Open Graph)
                <span className="text-xs font-medium text-muted">
                  Es la miniatura que muestran WhatsApp, Instagram, Facebook y
                  otros cuando pegas el link de tu web.
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    htmlFor="seoOgImageFile"
                    className="inline-flex items-center justify-center rounded-full border border-accent/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
                  >
                    Seleccionar imagen
                  </label>
                  <span className="text-xs text-muted">{seoOgFileName}</span>
                </div>
                <input
                  id="seoOgImageFile"
                  type="file"
                  name="seoOgImageFile"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleSeoOgFileChange}
                />
                <span className="text-xs font-medium text-muted">
                  Actual: {studio.seo.ogImage}
                </span>
              </label>
            </div>
          </details>

          <details className="rounded-2xl border border-accent/15 bg-white/80 p-5">
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-fg/80">
              CTAs y WhatsApp
            </summary>
            <div className="mt-4 grid gap-4">
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
              <label className="grid gap-2 text-sm font-semibold">
                URL Instagram
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                  type="url"
                  name="contactInstagram"
                  defaultValue={studio.contact.instagram}
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">
                  Numero de WhatsApp
                  <input
                    className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                    type="text"
                    name="whatsappPhone"
                    placeholder="+54 9 11 5852-4000"
                    defaultValue={studio.contact.whatsapp.phone}
                    required
                  />
                  <span className="text-xs font-medium text-muted">
                    Podes escribirlo con +, espacios o guiones. Se limpia
                    automaticamente al generar el link.
                  </span>
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
            </div>
          </details>

          <details className="rounded-2xl border border-accent/15 bg-white/80 p-5">
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-fg/80">
              Datos de contacto
            </summary>
            <div className="mt-4 grid gap-4">
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
            </div>
          </details>

          <details className="rounded-2xl border border-accent/15 bg-white/80 p-5">
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-fg/80">
              Listas y bloques
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
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
          </details>

          <details className="rounded-2xl border border-accent/15 bg-white/80 p-5">
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-fg/80">
              Footer
            </summary>
            <div className="mt-4 grid gap-2">
              <label className="grid gap-2 text-sm font-semibold">
                Texto del footer
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                  type="text"
                  name="footerText"
                  defaultValue={studio.footer.text}
                />
              </label>
            </div>
          </details>
        </div>
      </div>

      <div className="rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
        <h2 className="font-display text-2xl uppercase tracking-[0.2em]">
          Carrusel
        </h2>
        <p className="mt-2 text-sm text-muted">
          Gestiona las imagenes del carrusel del home.
        </p>

        <div className="mt-8 grid gap-6">

          <details className="rounded-2xl border border-accent/15 bg-white/80 p-5">
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-fg/80">
              Galeria del carrusel
            </summary>
            <div className="mt-4 grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
                <span>Hasta 10 imagenes. La nro 1 aparece primero en el carrusel del home.</span>
                <span>{galleryItems.length}/10</span>
              </div>

              <label className="grid gap-2 text-sm font-semibold">
                Subir imagenes
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    htmlFor="galleryUpload"
                    className="inline-flex items-center justify-center rounded-full border border-accent/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
                  >
                    Agregar imagenes
                  </label>
                  <span className="text-xs text-muted">
                    Arrastra para ordenar. Elimina para quitar.
                  </span>
                </div>
                <input
                  id="galleryUpload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={handleGalleryUpload}
                />
              </label>

              {galleryItems.length === 0 ? (
                <div className="rounded-2xl border border-accent/15 bg-bg/80 px-4 py-3 text-sm text-muted">
                  No hay imagenes cargadas.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {galleryItems.map((item, index) => (
                    <div
                      key={item.id}
                      className={`grid gap-3 rounded-2xl border border-accent/15 bg-white/70 p-4 ${
                        dragIndex === index ? "opacity-70" : ""
                      }`}
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDragEnd={() => setDragIndex(null)}
                      onDrop={() => {
                        if (dragIndex === null) return;
                        handleReorder(dragIndex, index);
                        setDragIndex(null);
                      }}
                    >
                      <div className="relative overflow-hidden rounded-2xl border border-accent/15 bg-bg">
                        <span className="absolute right-2 top-2 z-10 inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-accent/30 bg-bg/90 px-1 text-[10px] font-semibold leading-none text-accent shadow-[0_8px_18px_-14px_rgba(0,0,0,0.45)]">
                          {index + 1}
                        </span>
                        {item.previewUrl || item.src ? (
                          <img
                            className="h-40 w-full object-cover"
                            src={item.previewUrl || item.src}
                            alt={item.alt || "Imagen del estudio"}
                          />
                        ) : (
                          <div className="flex h-40 items-center justify-center text-xs text-muted">
                            Sin imagen
                          </div>
                        )}
                      </div>
                      <label className="grid gap-2 text-sm font-semibold">
                        Alt
                        <input
                          className="rounded-2xl border border-accent/20 bg-white px-4 py-2 text-sm outline-none transition focus:border-accent"
                          type="text"
                          value={item.alt}
                          onChange={(event) =>
                            handleGalleryAltChange(item.id, event.target.value)
                          }
                        />
                      </label>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                          Orden {index + 1} del carrusel
                        </span>
                        <button
                          className="rounded-full border border-accent/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
                          type="button"
                          onClick={() => handleRemoveGalleryItem(item.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
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




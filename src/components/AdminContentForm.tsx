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

type CatalogType = "included" | "extras";

type CatalogImageFormItem = {
  id: string;
  label: string;
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

const DEFAULT_WORDMARK_SRC = "/logo-largo.svg";
const buildCatalogImageAlt = (label: string) => `Imagen de ${label}`;

const createCatalogImageItems = ({
  labels,
  images,
  prefix,
}: {
  labels: string[];
  images: StudioContent["included"]["images"];
  prefix: CatalogType;
}) =>
  labels.map((label, index) => ({
    id: `${prefix}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    src: images[index]?.src || "",
    alt: images[index]?.alt || buildCatalogImageAlt(label),
  }));

export default function AdminContentForm({
  studio,
  gallery,
}: AdminContentFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [logoFileName, setLogoFileName] = useState("Ningún archivo seleccionado");
  const [wordmarkFileName, setWordmarkFileName] = useState(
    "Ningún archivo seleccionado"
  );
  const [seoOgFileName, setSeoOgFileName] = useState(
    "Ningún archivo seleccionado"
  );
  const [floorPlanFileName, setFloorPlanFileName] = useState(
    "Ningún archivo seleccionado"
  );
  const [galleryItems, setGalleryItems] = useState<GalleryFormItem[]>(() =>
    gallery.slice(0, 10).map((item, index) => ({
      id: `existing-${index}-${Math.random().toString(36).slice(2, 8)}`,
      src: item.src,
      alt: item.alt,
    }))
  );
  const [includedCatalogImages, setIncludedCatalogImages] = useState<
    CatalogImageFormItem[]
  >(() =>
    createCatalogImageItems({
      labels: studio.included.items,
      images: studio.included.images,
      prefix: "included",
    })
  );
  const [extrasCatalogImages, setExtrasCatalogImages] = useState<
    CatalogImageFormItem[]
  >(() =>
    createCatalogImageItems({
      labels: studio.extras.items,
      images: studio.extras.images,
      prefix: "extras",
    })
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const galleryItemsRef = useRef<GalleryFormItem[]>([]);
  const includedCatalogImagesRef = useRef<CatalogImageFormItem[]>([]);
  const extrasCatalogImagesRef = useRef<CatalogImageFormItem[]>([]);
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
    includedCatalogImagesRef.current = includedCatalogImages;
  }, [includedCatalogImages]);

  useEffect(() => {
    extrasCatalogImagesRef.current = extrasCatalogImages;
  }, [extrasCatalogImages]);

  useEffect(() => {
    return () => {
      galleryItemsRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      includedCatalogImagesRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      extrasCatalogImagesRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  const markAsDirty = () => {
    setHasUnsavedChanges(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasUnsavedChanges) {
      return;
    }
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

    const includedImagesPayload = includedCatalogImages.map((item) => ({
      id: item.id,
      src: item.src || "",
      alt: item.alt || "",
      label: item.label,
    }));
    formData.set("includedImagesOrder", JSON.stringify(includedImagesPayload));
    includedCatalogImages.forEach((item) => {
      if (item.file) {
        formData.append(`includedImageFile_${item.id}`, item.file);
      }
    });

    const extrasImagesPayload = extrasCatalogImages.map((item) => ({
      id: item.id,
      src: item.src || "",
      alt: item.alt || "",
      label: item.label,
    }));
    formData.set("extrasImagesOrder", JSON.stringify(extrasImagesPayload));
    extrasCatalogImages.forEach((item) => {
      if (item.file) {
        formData.append(`extrasImageFile_${item.id}`, item.file);
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
      setHasUnsavedChanges(false);
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
    setLogoFileName(file ? file.name : "Ningún archivo seleccionado");
  };

  const handleWordmarkFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    setWordmarkFileName(file ? file.name : "Ningún archivo seleccionado");
  };

  const handleSeoOgFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSeoOgFileName(file ? file.name : "Ningún archivo seleccionado");
  };

  const handleFloorPlanFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    setFloorPlanFileName(file ? file.name : "Ningún archivo seleccionado");
  };

  const handleGalleryUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    markAsDirty();
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
    markAsDirty();
    setGalleryItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, alt: value } : item))
    );
  };

  const handleRemoveGalleryItem = (id: string) => {
    markAsDirty();
    setGalleryItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const updateCatalogImages = (
    type: CatalogType,
    updater: (items: CatalogImageFormItem[]) => CatalogImageFormItem[]
  ) => {
    if (type === "included") {
      setIncludedCatalogImages(updater);
      return;
    }
    setExtrasCatalogImages(updater);
  };

  const handleCatalogImageAltChange = (
    type: CatalogType,
    id: string,
    value: string
  ) => {
    markAsDirty();
    updateCatalogImages(type, (prev) =>
      prev.map((item) => (item.id === id ? { ...item, alt: value } : item))
    );
  };

  const handleCatalogImageUpload = (
    type: CatalogType,
    id: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    markAsDirty();

    const previewUrl = URL.createObjectURL(file);
    updateCatalogImages(type, (prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
        return {
          ...item,
          file,
          previewUrl,
        };
      })
    );
    event.target.value = "";
  };

  const handleRemoveCatalogImage = (type: CatalogType, id: string) => {
    markAsDirty();
    updateCatalogImages(type, (prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
        return {
          ...item,
          src: "",
          file: undefined,
          previewUrl: undefined,
        };
      })
    );
  };

  const handleReorder = (from: number, to: number) => {
    if (from === to) return;
    markAsDirty();
    setGalleryItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const hasCustomWordmark =
    Boolean(studio.logo.wordmarkSrc) &&
    studio.logo.wordmarkSrc !== DEFAULT_WORDMARK_SRC;
  const [wordmarkCoreRaw, ...wordmarkTailParts] = (
    studio.name || "UNKT Estudio"
  )
    .trim()
    .split(/\s+/);
  const wordmarkCore = (wordmarkCoreRaw || "UNKT").toUpperCase();
  const wordmarkTail = (wordmarkTailParts.join(" ") || "Estudio").toUpperCase();

  return (
    <form
      className="grid w-full max-w-full min-w-0 gap-3 overflow-x-clip sm:gap-8 md:gap-10"
      onSubmit={handleSubmit}
      onChange={markAsDirty}
      encType="multipart/form-data"
    >
      <details className="group overflow-x-hidden rounded-3xl border border-accent/20 bg-white/70 p-5 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur sm:p-7 md:p-8">
        <summary className="flex list-none items-center justify-between gap-3 cursor-pointer [&::-webkit-details-marker]:hidden">
          <h1 className="font-display text-xl uppercase tracking-[0.08em] sm:text-3xl sm:tracking-[0.2em]">
            Texto
          </h1>
          <span
            aria-hidden
            className="text-sm text-accent transition-transform duration-200 group-open:rotate-180 sm:text-base"
          >
            ▾
          </span>
        </summary>

        <div className="mt-5 grid gap-4 sm:mt-8 sm:gap-6">
          <details
            className="rounded-2xl border border-accent/15 bg-white/80 p-4 sm:p-6"
          >
            <summary className="cursor-pointer break-words pr-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg/80 sm:text-sm sm:tracking-wide">
              Título y subtítulo
            </summary>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">
                  Título principal
                  <input
                    className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                    type="text"
                    name="heroTitle"
                    defaultValue={studio.hero.title}
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Subtítulo
                  <input
                    className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                    type="text"
                    name="heroSubtitle"
                    defaultValue={studio.hero.subtitle}
                    required
                  />
                </label>
              </div>
            </div>
          </details>

          <details className="rounded-2xl border border-accent/15 bg-white/80 p-4 sm:p-6">
            <summary className="cursor-pointer break-words pr-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg/80 sm:text-sm sm:tracking-wide">
              Ubicación
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Texto dirección
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                  type="text"
                  name="locationText"
                  defaultValue={studio.contact.locationText}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Link Google Maps
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                  type="url"
                  name="locationUrl"
                  defaultValue={studio.contact.locationUrl}
                />
              </label>
            </div>
          </details>

          <details className="rounded-2xl border border-accent/15 bg-white/80 p-4 sm:p-6">
            <summary className="cursor-pointer break-words pr-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg/80 sm:text-sm sm:tracking-wide">
              SEO y sitio
            </summary>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold">
                URL del sitio
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                  type="url"
                  name="siteUrl"
                  defaultValue={studio.siteUrl}
                  required
                />
                <span className="text-xs font-medium text-muted">
                  Ejemplo: https://tudominio.com. Si no pones protocolo, se
                  completa automáticamente.
                </span>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                SEO title
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                  type="text"
                  name="seoTitle"
                  defaultValue={studio.seo.title}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                SEO description
                <textarea
                  className="min-h-[96px] rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
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
                    className="inline-flex items-center justify-center rounded-full border border-accent/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10 sm:px-4 sm:py-2 sm:text-xs"
                  >
                    Seleccionar imagen
                  </label>
                  <span className="max-w-full break-all text-xs text-muted">
                    {seoOgFileName}
                  </span>
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

          <details className="rounded-2xl border border-accent/15 bg-white/80 p-4 sm:p-6">
            <summary className="cursor-pointer break-words pr-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg/80 sm:text-sm sm:tracking-wide">
              Datos de contacto
            </summary>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold">
                Correo de contacto
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                  type="email"
                  name="contactEmail"
                  defaultValue={studio.contact.email}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                URL Instagram
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                  type="url"
                  name="contactInstagram"
                  defaultValue={studio.contact.instagram}
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">
                  Numero de WhatsApp
                  <input
                    className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                    type="text"
                    name="whatsappPhone"
                    placeholder="+54 9 11 5852-4000"
                    defaultValue={studio.contact.whatsapp.phone}
                    required
                  />
                  <span className="text-xs font-medium text-muted">
                    Podés escribirlo con +, espacios o guiones. Se limpia
                    automáticamente al generar el enlace.
                  </span>
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Mensaje WhatsApp
                  <input
                    className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                    type="text"
                    name="whatsappMessage"
                    defaultValue={studio.contact.whatsapp.message}
                    required
                  />
                </label>
              </div>
            </div>
          </details>

          <details
            id="precios"
            className="rounded-2xl border border-accent/15 bg-white/80 p-4 sm:p-6"
          >
            <summary className="cursor-pointer break-words pr-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg/80 sm:text-sm sm:tracking-wide">
              Listas y bloques
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="grid gap-3">
                <label className="grid gap-2 text-sm font-semibold">
                  Título incluido
                  <input
                    className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:text-sm"
                    type="text"
                    name="includedTitle"
                    defaultValue={studio.included.title}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Subtítulo incluido
                  <input
                    className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:text-sm"
                    type="text"
                    name="includedSubtitle"
                    defaultValue={studio.included.subtitle}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Incluido (uno por línea)
                  <textarea
                    className="min-h-[120px] rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                    name="includedItems"
                    defaultValue={studio.included.items.join("\n")}
                  />
                </label>
              </div>
              <div className="grid gap-3">
                <label className="grid gap-2 text-sm font-semibold">
                  Título extras
                  <input
                    className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:text-sm"
                    type="text"
                    name="extrasTitle"
                    defaultValue={studio.extras.title}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Subtítulo extras
                  <input
                    className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:text-sm"
                    type="text"
                    name="extrasSubtitle"
                    defaultValue={studio.extras.subtitle}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Colores de fondos (uno por linea, maximo 5)
                  <textarea
                    className="min-h-[120px] rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                    name="extrasItems"
                    defaultValue={studio.extras.items.join("\n")}
                  />
                </label>
              </div>
            </div>
          </details>

          <details className="rounded-2xl border border-accent/15 bg-white/80 p-4 sm:p-6">
            <summary className="cursor-pointer break-words pr-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg/80 sm:text-sm sm:tracking-wide">
              Políticas y condiciones
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Política de cancelación (un punto por línea)
                <textarea
                  className="min-h-[140px] rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                  name="footerPoliciesCancellation"
                  defaultValue={studio.footer.policies.cancellation.join("\n")}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Condiciones de reserva (un punto por linea)
                <textarea
                  className="min-h-[140px] rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                  name="footerPoliciesBooking"
                  defaultValue={studio.footer.policies.booking.join("\n")}
                />
              </label>
            </div>
          </details>
        </div>
      </details>

          <details className="group overflow-x-hidden rounded-3xl border border-accent/20 bg-white/70 p-5 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur sm:p-7 md:p-8">
            <summary className="flex list-none items-center justify-between gap-3 cursor-pointer [&::-webkit-details-marker]:hidden">
              <h2 className="font-display text-lg uppercase tracking-[0.08em] sm:text-2xl sm:tracking-[0.2em]">
                Imagenes
              </h2>
          <span
            aria-hidden
            className="text-sm text-accent transition-transform duration-200 group-open:rotate-180 sm:text-base"
          >
            ▾
          </span>
        </summary>

        <div className="mt-5 grid gap-4 sm:mt-8 sm:gap-6">
          <details
            className="rounded-2xl border border-accent/15 bg-white/80 p-4 sm:p-6"
          >
            <summary className="cursor-pointer break-words pr-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg/80 sm:text-sm sm:tracking-wide">
              Logos
            </summary>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid gap-3">
                  <div className="overflow-hidden rounded-2xl border border-accent/20 bg-bg p-3">
                    <img
                      className="h-14 w-14 rounded-full object-cover sm:h-20 sm:w-20"
                      src={studio.logo.src}
                      alt={studio.logo.alt}
                    />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Logo actual
                  </span>
                </div>
                <div className="grid gap-3">
                  <div className="overflow-hidden rounded-2xl border border-accent/20 bg-bg p-3">
                    {hasCustomWordmark ? (
                      <img
                        className="h-14 w-full object-contain sm:h-20"
                        src={studio.logo.wordmarkSrc}
                        alt={studio.logo.alt}
                      />
                    ) : (
                      <div className="flex h-14 min-w-0 items-center gap-1.5 overflow-hidden text-accent sm:h-20 sm:gap-2">
                        <span className="truncate text-lg font-semibold uppercase tracking-[0.08em] sm:text-xl">
                          {wordmarkCore}
                        </span>
                        <span className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-accent/82 sm:text-sm">
                          {wordmarkTail}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Wordmark actual
                  </span>
                </div>
              </div>
              <label className="grid gap-2 text-sm font-semibold">
                Wordmark (texto)
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                  type="text"
                  name="name"
                  defaultValue={studio.name}
                  required
                />
                <span className="text-xs font-medium text-muted">
                  Si no subes imagen para el wordmark, se muestra este texto en
                  el header.
                </span>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Alt del logo
                <input
                  className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                  type="text"
                  name="logoAlt"
                  defaultValue={studio.logo.alt}
                  required
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">
                  Reemplazar logo (avatar)
                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      htmlFor="logoImageSeo"
                      className="inline-flex items-center justify-center rounded-full border border-accent/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10 sm:px-4 sm:py-2 sm:text-xs"
                    >
                      Seleccionar imagen
                    </label>
                    <span className="max-w-full break-all text-xs text-muted">
                      {logoFileName}
                    </span>
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
                      className="inline-flex items-center justify-center rounded-full border border-accent/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10 sm:px-4 sm:py-2 sm:text-xs"
                    >
                      Seleccionar imagen
                    </label>
                    <span className="max-w-full break-all text-xs text-muted">
                      {wordmarkFileName}
                    </span>
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
            </div>
          </details>

          <details className="rounded-2xl border border-accent/15 bg-white/80 p-4 sm:p-6">
            <summary className="cursor-pointer break-words pr-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg/80 sm:text-sm sm:tracking-wide">
              Galeria del carrusel
            </summary>
            <div className="mt-4 grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
                <span>Hasta 10 imágenes. La n.º 1 aparece primero en el carrusel del home.</span>
                <span>{galleryItems.length}/10</span>
              </div>

              <label className="grid gap-2 text-sm font-semibold">
                Subir imágenes
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    htmlFor="galleryUpload"
                    className="inline-flex items-center justify-center rounded-full border border-accent/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
                  >
                    Agregar imágenes
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
                  No hay imágenes cargadas.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {galleryItems.map((item, index) => (
                    <div
                      key={item.id}
                      className={`grid gap-3 rounded-2xl border border-accent/15 bg-white/70 p-3 sm:p-4 ${
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
                            className="h-28 w-full object-cover sm:h-40"
                            src={item.previewUrl || item.src}
                            alt={item.alt || "Imagen del estudio"}
                          />
                        ) : (
                          <div className="flex h-28 items-center justify-center text-xs text-muted sm:h-40">
                            Sin imagen
                          </div>
                        )}
                      </div>
                      <label className="grid gap-2 text-sm font-semibold">
                        Alt
                        <input
                          className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:text-sm"
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

          <details className="rounded-2xl border border-accent/15 bg-white/80 p-4 sm:p-6">
            <summary className="cursor-pointer break-words pr-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg/80 sm:text-sm sm:tracking-wide">
              Plano
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="grid gap-3">
                <div className="overflow-hidden rounded-2xl border border-accent/20 bg-bg p-3">
                  <img
                    className="h-36 w-full rounded-xl object-contain sm:h-48"
                    src={studio.floorPlan.src}
                    alt={studio.floorPlan.alt}
                  />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Plano actual en el home
                </span>
              </div>

              <div className="grid gap-4">
                <label className="grid gap-2 text-sm font-semibold">
                  Alt del plano
                  <input
                    className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:py-3 sm:text-sm"
                    type="text"
                    name="floorPlanAlt"
                    defaultValue={studio.floorPlan.alt}
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold">
                  Reemplazar plano
                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      htmlFor="floorPlanImage"
                      className="inline-flex items-center justify-center rounded-full border border-accent/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10 sm:px-4 sm:py-2 sm:text-xs"
                    >
                      Seleccionar imagen
                    </label>
                    <span className="max-w-full break-all text-xs text-muted">
                      {floorPlanFileName}
                    </span>
                  </div>
                  <input
                    id="floorPlanImage"
                    type="file"
                    name="floorPlanImage"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleFloorPlanFileChange}
                  />
                </label>
              </div>
            </div>
          </details>

          <details className="rounded-2xl border border-accent/15 bg-white/80 p-4 sm:p-6">
            <summary className="cursor-pointer break-words pr-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg/80 sm:text-sm sm:tracking-wide">
              Imágenes de incluidos y extras
            </summary>
            <div className="mt-4 grid gap-6">
              <div className="grid gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Incluidos
                </p>
                {includedCatalogImages.length === 0 ? (
                  <div className="rounded-2xl border border-accent/15 bg-bg/80 px-4 py-3 text-sm text-muted">
                    No hay incluidos cargados.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {includedCatalogImages.map((item) => {
                      const uploadId = `included-image-${item.id}`;
                      return (
                        <div
                          key={item.id}
                          className="grid gap-3 rounded-2xl border border-accent/15 bg-white/70 p-3 sm:p-4"
                        >
                          <div className="relative overflow-hidden rounded-2xl border border-accent/15 bg-bg">
                            {item.previewUrl || item.src ? (
                              <img
                                className="h-28 w-full object-cover sm:h-40"
                                src={item.previewUrl || item.src}
                                alt={item.alt || buildCatalogImageAlt(item.label)}
                              />
                            ) : (
                              <div className="flex h-28 items-center justify-center text-xs text-muted sm:h-40">
                                Sin imagen
                              </div>
                            )}
                          </div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                            {item.label}
                          </p>
                          <label className="grid gap-2 text-sm font-semibold">
                            Alt
                            <input
                              className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:text-sm"
                              type="text"
                              value={item.alt}
                              onChange={(event) =>
                                handleCatalogImageAltChange(
                                  "included",
                                  item.id,
                                  event.target.value
                                )
                              }
                            />
                          </label>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label
                              htmlFor={uploadId}
                              className="inline-flex items-center justify-center rounded-full border border-accent/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
                            >
                              Subir imagen
                            </label>
                            <button
                              className="rounded-full border border-accent/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
                              type="button"
                              onClick={() =>
                                handleRemoveCatalogImage("included", item.id)
                              }
                            >
                              Quitar
                            </button>
                          </div>
                          <input
                            id={uploadId}
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(event) =>
                              handleCatalogImageUpload("included", item.id, event)
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Extras
                </p>
                {extrasCatalogImages.length === 0 ? (
                  <div className="rounded-2xl border border-accent/15 bg-bg/80 px-4 py-3 text-sm text-muted">
                    No hay extras cargados.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {extrasCatalogImages.map((item) => {
                      const uploadId = `extras-image-${item.id}`;
                      return (
                        <div
                          key={item.id}
                          className="grid gap-3 rounded-2xl border border-accent/15 bg-white/70 p-3 sm:p-4"
                        >
                          <div className="relative overflow-hidden rounded-2xl border border-accent/15 bg-bg">
                            {item.previewUrl || item.src ? (
                              <img
                                className="h-28 w-full object-cover sm:h-40"
                                src={item.previewUrl || item.src}
                                alt={item.alt || buildCatalogImageAlt(item.label)}
                              />
                            ) : (
                              <div className="flex h-28 items-center justify-center text-xs text-muted sm:h-40">
                                Sin imagen
                              </div>
                            )}
                          </div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                            {item.label}
                          </p>
                          <label className="grid gap-2 text-sm font-semibold">
                            Alt
                            <input
                              className="rounded-2xl border border-accent/20 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-accent sm:px-4 sm:text-sm"
                              type="text"
                              value={item.alt}
                              onChange={(event) =>
                                handleCatalogImageAltChange(
                                  "extras",
                                  item.id,
                                  event.target.value
                                )
                              }
                            />
                          </label>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label
                              htmlFor={uploadId}
                              className="inline-flex items-center justify-center rounded-full border border-accent/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
                            >
                              Subir imagen
                            </label>
                            <button
                              className="rounded-full border border-accent/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
                              type="button"
                              onClick={() =>
                                handleRemoveCatalogImage("extras", item.id)
                              }
                            >
                              Quitar
                            </button>
                          </div>
                          <input
                            id={uploadId}
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(event) =>
                              handleCatalogImageUpload("extras", item.id, event)
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </details>
        </div>

      </details>

      <div className="relative">
        <button
          className="inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-4 text-sm font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 disabled:cursor-not-allowed disabled:opacity-70"
          type="submit"
          disabled={status === "saving" || !hasUnsavedChanges}
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





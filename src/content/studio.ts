export const studio = {
  name: "UNKT Estudio",
  siteUrl: "https://unktestudio.com",
  seo: {
    title: "UNKT Estudio | Alquiler de estudio fotográfico",
    description:
      "Alquiler de estudio fotográfico listo para producir. Luces, difusores y fondos incluidos. Reservá online.",
    ogImage: "/hero-placeholder.svg",
  },
  hero: {
    title: "Un estudio listo para producir.",
    subtitle: "Entrás, prendés las luces y trabajás.",
    image: {
      src: "/hero-placeholder.svg",
      alt: "Vista del estudio fotográfico con fondo y luces.",
    },
  },
  gallery: [
    {
      src: "/gallery-1.svg",
      alt: "Área principal con fondo crema y luz suave.",
    },
    {
      src: "/gallery-2.svg",
      alt: "Equipo de iluminación y difusores en el set.",
    },
    {
      src: "/gallery-3.svg",
      alt: "Rincón con sillón y accesorios.",
    },
    {
      src: "/gallery-4.svg",
      alt: "Vista general del estudio con fondos.",
    },
    {
      src: "/gallery-5.svg",
      alt: "Detalle de accesorios de acero.",
    },
    {
      src: "/gallery-6.svg",
      alt: "Zona de trabajo con espacio despejado.",
    },
  ],
  included: {
    title: "Incluido",
    subtitle: "Llegás y ya está armado.",
    items: ["Luces", "Difusores", "Fondos"],
  },
  extras: {
    title: "Extras",
    subtitle: "Sumalos si los necesitás.",
    items: ["Sillón", "Accesorios de acero"],
  },
  howToBook: {
    title: "Cómo reservar",
    steps: [
      "Elegí el horario disponible.",
      "Completá tus datos y seleccioná extras.",
      "Pagá para confirmar la reserva.",
    ],
  },
  contact: {
    title: "Reservá ahora",
    note: "Elegí horario, completá tus datos y confirmá el pago.",
    whatsapp: {
      phone: "5491158524000",
      message:
        "Hola, quiero reservar UNKT Estudio. Fecha: __ / Horario: __ / Extras: __",
    },
    instagram: "https://instagram.com/unktestudio",
    email: "hola@unktestudio.com",
    locationText: "(Sumar dirección)",
    locationUrl: "https://maps.google.com/?q=UNKT+Estudio",
    hours: "(Sumar horarios)",
  },
  ctas: {
    primary: "Reservar",
    secondary: "Consultar disponibilidad",
  },
  footer: {
    text: "UNKT Estudio. Alquiler de estudio fotográfico.",
  },
};

export type StudioContent = typeof studio;

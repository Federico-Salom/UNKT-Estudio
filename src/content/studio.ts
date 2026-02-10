const includedItems = [
  "Luces",
  "Difusores",
  "Fondos",
  "Sillon",
  "Accesorios de acero",
];

const extraItems = [
  "Bajada de fondo sin pisar - $20.000",
  "Bajada de fondo pisando - $35.000",
];

const buildCatalogImageDefaults = (items: string[]) =>
  items.map((item) => ({
    src: "",
    alt: `Imagen de ${item}`,
  }));

export const studio = {
  name: "UNKT Estudio",
  siteUrl: "https://unktestudio.com",
  logo: {
    src: "/logo.jpg",
    wordmarkSrc: "/logo-largo.svg",
    alt: "Logo UNKT Estudio",
  },
  seo: {
    title: "UNKT Estudio | Alquiler de estudio fotografico",
    description:
      "Alquiler de estudio fotografico listo para producir. Luces, difusores y fondos incluidos. Reserva online.",
    ogImage: "/logo.jpg",
  },
  hero: {
    title: "Un estudio listo para producir",
    subtitle: "Entras, prendes las luces y trabajas.",
    image: {
      src: "/hero-placeholder.svg",
      alt: "Vista del estudio fotografico con fondo y luces.",
    },
  },
  floorPlan: {
    src: "/plano-estudio.svg",
    alt: "Plano del lugar",
  },
  gallery: [
    {
      src: "/gallery-1.svg",
      alt: "Area principal del estudio.",
    },
    {
      src: "/hero-placeholder.svg",
      alt: "Set secundario del estudio.",
    },
  ],
  included: {
    title: "Incluido",
    subtitle: "Llegas y ya esta armado.",
    items: includedItems,
    images: buildCatalogImageDefaults(includedItems),
  },
  extras: {
    title: "Extras",
    subtitle:
      "Bajadas de fondos en rojo, negro y blanco. Se cobran una sola vez por reserva y solo podes elegir una variante.",
    items: extraItems,
    images: buildCatalogImageDefaults(extraItems),
  },
  howToBook: {
    title: "Como reservar",
    steps: [
      "Elegi el horario disponible.",
      "Completa tus datos y selecciona extras.",
      "Paga para confirmar la reserva.",
    ],
  },
  contact: {
    title: "Reserva ahora",
    note: "Elegi horario, completa tus datos y confirma el pago.",
    whatsapp: {
      phone: "5491158524000",
      message:
        "Hola, quiero reservar UNKT Estudio. Fecha: __ / Horario: __ / Extras: __",
    },
    instagram: "https://www.instagram.com/unkt.estudio/",
    email: "hola@unktestudio.com",
    locationText: "(Sumar direccion)",
    locationUrl: "https://maps.google.com/?q=UNKT+Estudio",
    hours: "(Sumar horarios)",
  },
  ctas: {
    primary: "Reservar",
    secondary: "Consultar disponibilidad",
  },
  footer: {
    text: "Alquiler de estudio fotografico.",
  },
};

export type StudioContent = typeof studio;

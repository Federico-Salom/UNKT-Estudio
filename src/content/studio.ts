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
  pricing: {
    basePrice: 40000,
  },
  contact: {
    whatsapp: {
      phone: "5491158524000",
      message:
        "Hola, quiero reservar UNKT Estudio. Fecha: __ / Horario: __ / Extras: __",
    },
    instagram: "https://www.instagram.com/unkt.estudio/",
    email: "hola@unktestudio.com",
    locationText: "",
    locationUrl: "",
  },
  ctas: {
    primary: "Reservar",
  },
  footer: {
    policies: {
      cancellation: [
        "Las cancelaciones o reprogramaciones se gestionan por WhatsApp con al menos 24 horas de anticipacion.",
        "Con 24 horas o mas, se permite una unica reprogramacion sin cargo, sujeta a disponibilidad.",
        "Con menos de 24 horas, en caso de no presentarse o llegar con demoras que afecten el turno, no hay reintegro.",
        "Si UNKT Estudio debe cancelar por fuerza mayor, se ofrece reprogramacion prioritaria o reintegro total.",
      ],
      booking: [
        "La reserva minima es de 2 horas consecutivas.",
        "Solo se habilitan reservas con un minimo de 2 horas de anticipacion.",
        "La reserva queda confirmada cuando el pago figura acreditado por Mercado Pago.",
        "Los extras se cobran una sola vez por reserva. Solo se puede elegir una variante y se asignan segun disponibilidad.",
        "El uso del estudio debe respetar el horario contratado para no afectar los turnos siguientes.",
      ],
    },
  },
};

export type StudioContent = typeof studio;

export type CatalogImage = {
  src: string;
  alt: string;
};

export type ExtraBackground = {
  id: string;
  color: string;
  priceSinPisar: number;
  pricePisando: number;
};

export type StudioContent = {
  name: string;
  siteUrl: string;
  logo: {
    src: string;
    wordmarkSrc: string;
    alt: string;
  };
  seo: {
    title: string;
    description: string;
    ogImage: string;
  };
  hero: {
    title: string;
    subtitle: string;
    image: CatalogImage;
  };
  floorPlan: CatalogImage;
  gallery: CatalogImage[];
  included: {
    title: string;
    subtitle: string;
    items: string[];
    images: CatalogImage[];
  };
  extras: {
    title: string;
    subtitle: string;
    maxSelections: number;
    items: string[];
    backgrounds: ExtraBackground[];
    images: CatalogImage[];
  };
  pricing: {
    basePrice: number;
  };
  contact: {
    whatsapp: {
      phone: string;
      message: string;
    };
    instagram: string;
    email: string;
    locationText: string;
    locationUrl: string;
  };
  ctas: {
    primary: string;
  };
  footer: {
    policies: {
      cancellation: string[];
      booking: string[];
    };
  };
};

const includedItems = [
  "Luces",
  "Difusores",
  "Fondos",
  "Sillón",
  "Accesorios de acero",
];

const extraBackgrounds: ExtraBackground[] = [
  {
    id: "rojo",
    color: "Rojo",
    priceSinPisar: 20000,
    pricePisando: 35000,
  },
  {
    id: "negro",
    color: "Negro",
    priceSinPisar: 20000,
    pricePisando: 35000,
  },
  {
    id: "blanco",
    color: "Blanco",
    priceSinPisar: 20000,
    pricePisando: 35000,
  },
];

const extraItems = extraBackgrounds.map((item) => item.color);

const buildCatalogImageDefaults = (items: string[]): CatalogImage[] =>
  items.map((item) => ({
    src: "",
    alt: `Imagen de ${item}`,
  }));

export const studio: StudioContent = {
  name: "UNKT Estudio",
  siteUrl: "https://unktestudio.com",
  logo: {
    src: "/logo.jpg",
    wordmarkSrc: "/logo-largo.svg",
    alt: "Logo UNKT Estudio",
  },
  seo: {
    title: "UNKT Estudio | Alquiler de estudio fotográfico",
    description:
      "Alquiler de estudio fotográfico listo para producir. Luces, difusores y fondos incluidos. Reserva online.",
    ogImage: "/logo.jpg",
  },
  hero: {
    title: "Un estudio listo para producir",
    subtitle: "Entras, prendes las luces y trabajas.",
    image: {
      src: "/hero-placeholder.svg",
      alt: "Vista del estudio fotográfico con fondo y luces.",
    },
  },
  floorPlan: {
    src: "/plano-estudio.svg",
    alt: "Plano del lugar",
  },
  gallery: [
    {
      src: "/gallery-1.svg",
      alt: "Área principal del estudio.",
    },
    {
      src: "/hero-placeholder.svg",
      alt: "Set secundario del estudio.",
    },
  ],
  included: {
    title: "Incluido",
    subtitle: "Llegas y ya está armado.",
    items: includedItems,
    images: buildCatalogImageDefaults(includedItems),
  },
  extras: {
    title: "Extras",
    subtitle:
      "Elegí hasta 5 colores de fondo. Cada color se cobra por separado y podés indicar si es sin pisar o pisando.",
    maxSelections: 5,
    items: extraItems,
    backgrounds: extraBackgrounds,
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
        "Las cancelaciones o reprogramaciones se gestionan por WhatsApp con al menos 24 horas de anticipación.",
        "Con 24 horas o más, se permite una única reprogramación sin cargo, sujeta a disponibilidad.",
        "Con menos de 24 horas, en caso de no presentarse o llegar con demoras que afecten el turno, no hay reintegro.",
        "Si UNKT Estudio debe cancelar por fuerza mayor, se ofrece reprogramación prioritaria o reintegro total.",
      ],
      booking: [
        "La reserva mínima es de 2 horas consecutivas.",
        "Solo se habilitan reservas con un mínimo de 2 horas de anticipación.",
        "La reserva queda confirmada cuando el pago figura acreditado por Mercado Pago.",
        "Los extras se cobran por cada color de fondo seleccionado (hasta 5).",
        "Cada fondo extra puede configurarse como sin pisar o pisando según necesidad.",
        "El uso del estudio debe respetar el horario contratado para no afectar los turnos siguientes.",
      ],
    },
  },
};

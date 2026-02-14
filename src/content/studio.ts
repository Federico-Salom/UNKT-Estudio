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

export type ServiceOption = {
  id: string;
  label: string;
  price: number;
  minHours?: number;
  description?: string;
};

export type ServiceCatalog = {
  title: string;
  subtitle: string;
  description: string;
  bookingNotice: string;
  photographyTitle: string;
  photographyHint: string;
  photographyOptions: ServiceOption[];
  modelsTitle: string;
  modelsHint: string;
  maxModels: number;
  modelRatePerHour: number;
  makeupTitle: string;
  makeupHint: string;
  makeupOptions: ServiceOption[];
  hairstyleTitle: string;
  hairstyleHint: string;
  hairstyleLabel: string;
  hairstyleRatePerModel: number;
  stylingTitle: string;
  stylingHint: string;
  stylingOptions: ServiceOption[];
  artDirectionTitle: string;
  artDirectionHint: string;
  artDirectionOptions: ServiceOption[];
  lightOperatorTitle: string;
  lightOperatorHint: string;
  lightOperatorLabel: string;
  lightOperatorRatePerHour: number;
  assistantsTitle: string;
  assistantsHint: string;
  assistantsLabel: string;
  maxAssistants: number;
  assistantsRatePerHour: number;
  totalsTitle: string;
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
  services: ServiceCatalog;
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
  "Sill\u00f3n Chesterfield",
  "Espacio de acero",
  "Mobiliario",
  "Zona MKP",
  "Zona planchado",
  "Cocina",
  "Ba\u00f1os",
  "Terraza",
  "WiFi",
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

const photographyOptions: ServiceOption[] = [
  {
    id: "foto-15",
    label: "15 fotos finales editadas",
    price: 180000,
    minHours: 3,
  },
  {
    id: "foto-25",
    label: "25 fotos finales editadas",
    price: 280000,
    minHours: 4,
  },
  {
    id: "foto-35",
    label: "35 fotos finales editadas",
    price: 380000,
    minHours: 5,
  },
];

const makeupOptions: ServiceOption[] = [
  {
    id: "makeup-artist",
    label: "Makeup Artist (editorial / alta moda)",
    price: 95000,
  },
  {
    id: "makeup-natural",
    label: "Makeup Natural",
    price: 50000,
  },
];

const stylingOptions: ServiceOption[] = [
  {
    id: "asesoria-personalizada",
    label: "Asesor\u00eda personalizada",
    price: 190000,
    description: "Servicio creativo. Producci\u00f3n adicional se presupuesta aparte.",
  },
];

const artDirectionOptions: ServiceOption[] = [
  {
    id: "equipo-especializado",
    label: "Equipo especializado",
    price: 190000,
    description: "Servicio creativo. Producci\u00f3n adicional se presupuesta aparte.",
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
    title: "UNKT Estudio | Alquiler de estudio fotogr\u00e1fico",
    description:
      "Alquiler de estudio fotogr\u00e1fico listo para producir. Luces, difusores y fondos incluidos. Reserva online.",
    ogImage: "/logo.jpg",
  },
  hero: {
    title: "Un estudio listo para producir",
    subtitle: "Entr\u00e1s, prend\u00e9s las luces y trabajas.",
    image: {
      src: "/hero-placeholder.svg",
      alt: "Vista del estudio fotogr\u00e1fico con fondo y luces.",
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
    subtitle: "Lleg\u00e1s y ya est\u00e1 armado.",
    items: includedItems,
    images: buildCatalogImageDefaults(includedItems),
  },
  extras: {
    title: "Fondos",
    subtitle:
      "Eleg\u00ed hasta 5 colores de fondo. Cada color se cobra por separado y pod\u00e9s indicar si es sin pisar o pisando.",
    maxSelections: 5,
    items: extraItems,
    backgrounds: extraBackgrounds,
    images: buildCatalogImageDefaults(extraItems),
  },
  services: {
    title: "Servicios UNKT Estudio",
    subtitle: "Eleg\u00ed tu producci\u00f3n fotogr\u00e1fica",
    description:
      "Incluye producci\u00f3n en estudio + edici\u00f3n profesional + entrega digital.",
    bookingNotice: "Reservas con m\u00ednimo 5 d\u00edas de anticipaci\u00f3n.",
    photographyTitle: "Fotograf\u00eda",
    photographyHint:
      "Opcional. Si eleg\u00eds una opci\u00f3n, las horas seleccionadas se usan como base de c\u00e1lculo.",
    photographyOptions,
    modelsTitle: "Modelos",
    modelsHint:
      "Opcional (hasta 10 modelos). C\u00e1lculo autom\u00e1tico: cantidad de modelos x horas x tarifa.",
    maxModels: 10,
    modelRatePerHour: 60000,
    makeupTitle: "Maquillaje",
    makeupHint: "Opcional por modelo. C\u00e1lculo autom\u00e1tico seg\u00fan cantidad de modelos.",
    makeupOptions,
    hairstyleTitle: "Peinado",
    hairstyleHint: "Opcional por modelo.",
    hairstyleLabel: "Peinado",
    hairstyleRatePerModel: 20000,
    stylingTitle: "Estilismo",
    stylingHint: "Opcional - solo una opci\u00f3n.",
    stylingOptions,
    artDirectionTitle: "Direcci\u00f3n de arte",
    artDirectionHint: "Opcional - solo una opci\u00f3n.",
    artDirectionOptions,
    lightOperatorTitle: "Operador de luces",
    lightOperatorHint: "Opcional - solo una opci\u00f3n.",
    lightOperatorLabel: "Disposici\u00f3n durante la jornada",
    lightOperatorRatePerHour: 30000,
    assistantsTitle: "Asistentes de producci\u00f3n",
    assistantsHint:
      "Opcional - cantidad seleccionable. C\u00e1lculo autom\u00e1tico: cantidad x horas x tarifa.",
    assistantsLabel: "Disposici\u00f3n durante la jornada",
    maxAssistants: 10,
    assistantsRatePerHour: 30000,
    totalsTitle: "Total servicios",
  },
  pricing: {
    basePrice: 40000,
  },
  contact: {
    whatsapp: {
      phone: "5491158524000",
      message:
        "Hola, quiero reservar UNKT Estudio. Fecha: __ / Horario: __ / Fondos: __ / Servicios: __",
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
        "Las cancelaciones o reprogramaciones se gestionan por WhatsApp con al menos 24 horas de anticipaci\u00f3n.",
        "Con 24 horas o m\u00e1s, se permite una \u00fanica reprogramaci\u00f3n sin cargo, sujeta a disponibilidad.",
        "Con menos de 24 horas, en caso de no presentarse o llegar con demoras que afecten el turno, no hay reintegro.",
        "Si UNKT Estudio debe cancelar por fuerza mayor, se ofrece reprogramaci\u00f3n prioritaria o reintegro total.",
      ],
      booking: [
        "La reserva m\u00ednima es de 2 horas consecutivas.",
        "Solo se habilitan reservas con un m\u00ednimo de 2 horas de anticipaci\u00f3n.",
        "La reserva queda confirmada cuando el pago figura acreditado por Mercado Pago.",
        "Los fondos se cobran por cada color de fondo seleccionado (hasta 5).",
        "Cada fondo puede configurarse como sin pisar o pisando seg\u00fan necesidad.",
        "S\u00e1bados, domingos y feriados tienen un recargo del 30% sobre la tarifa por hora.",
        "La franja nocturna (de 22:00 a 08:00) tiene un recargo del 40% sobre la tarifa por hora.",
        "Los servicios se calculan autom\u00e1ticamente por categor\u00eda y se suman al total general.",
        "Para producciones con servicios, la reserva debe hacerse con m\u00ednimo 5 d\u00edas de anticipaci\u00f3n.",
      ],
    },
  },
};


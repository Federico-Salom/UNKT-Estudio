import type { Metadata } from "next";
import { Gayathri, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { getStudioContent } from "@/lib/studio-content";
import VisitTracker from "@/components/VisitTracker";

const FALLBACK_SITE_URL = "https://unktestudio.com";
const THEME_STORAGE_KEY = "unkt-theme";

const resolveSafeSiteUrl = (value: string) => {
  const candidate = (value || "").trim();
  if (!candidate) return FALLBACK_SITE_URL;
  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;
  try {
    return new URL(withProtocol).toString().replace(/\/$/, "");
  } catch {
    return FALLBACK_SITE_URL;
  }
};

const bodyFont = Gayathri({
  subsets: ["latin"],
  weight: ["100", "400", "700"],
  variable: "--font-body",
});

const displayFont = Gayathri({
  subsets: ["latin"],
  weight: ["100", "400", "700"],
  variable: "--font-head",
});

const controlFont = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-controls",
});

export async function generateMetadata(): Promise<Metadata> {
  const studio = await getStudioContent();
  const safeSiteUrl = resolveSafeSiteUrl(studio.siteUrl);

  return {
    metadataBase: new URL(safeSiteUrl),
    title: studio.seo.title,
    description: studio.seo.description,
    alternates: {
      canonical: safeSiteUrl,
    },
    openGraph: {
      title: studio.seo.title,
      description: studio.seo.description,
      url: safeSiteUrl,
      siteName: studio.name,
      locale: "es_AR",
      type: "website",
      images: [
        {
          url: studio.seo.ogImage,
          width: 1200,
          height: 630,
          alt: studio.name,
        },
      ],
    },
    icons: {
      icon: studio.logo?.src || "/logo.jpg",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeInitScript = `
    (function () {
      try {
        var key = "${THEME_STORAGE_KEY}";
        var root = document.documentElement;
        var saved = window.localStorage.getItem(key);
        var theme =
          saved === "light" || saved === "dark"
            ? saved
            : window.matchMedia("(prefers-color-scheme: dark)").matches
              ? "dark"
              : "light";
        root.dataset.theme = theme;
        root.style.colorScheme = theme;
      } catch (e) {}
    })();
  `;

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body
        className={`${bodyFont.variable} ${displayFont.variable} ${controlFont.variable} font-sans antialiased`}
      >
        <VisitTracker />
        {children}
      </body>
    </html>
  );
}

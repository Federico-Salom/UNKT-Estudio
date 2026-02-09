import type { Metadata } from "next";
import { Lobster, Nunito } from "next/font/google";
import "./globals.css";
import { getStudioContent } from "@/lib/studio-content";
import VisitTracker from "@/components/VisitTracker";

const bodyFont = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

const displayFont = Lobster({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-head",
});

export async function generateMetadata(): Promise<Metadata> {
  const studio = await getStudioContent();

  return {
    metadataBase: new URL(studio.siteUrl),
    title: studio.seo.title,
    description: studio.seo.description,
    alternates: {
      canonical: studio.siteUrl,
    },
    openGraph: {
      title: studio.seo.title,
      description: studio.seo.description,
      url: studio.siteUrl,
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
  return (
    <html lang="es">
      <body
        className={`${bodyFont.variable} ${displayFont.variable} font-sans antialiased`}
      >
        <VisitTracker />
        {children}
      </body>
    </html>
  );
}

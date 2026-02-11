import Footer from "@/components/Footer";
import Gallery from "@/components/Gallery";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

export default async function Home() {
  const studio = await getStudioContent();

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <Header studio={studio} />
      <main className="flex-1">
        <Hero studio={studio} />
        <Gallery studio={studio} />
      </main>
      <Footer studio={studio} />
    </div>
  );
}

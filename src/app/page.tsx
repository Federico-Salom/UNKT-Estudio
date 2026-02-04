import Extras from "@/components/Extras";
import Footer from "@/components/Footer";
import Gallery from "@/components/Gallery";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Included from "@/components/Included";
import WhatsAppButton from "@/components/WhatsAppButton";
import { getStudioContent } from "@/lib/studio-content";

export const dynamic = "force-dynamic";

export default async function Home() {
  const studio = await getStudioContent();

  return (
    <div className="min-h-screen bg-bg text-fg">
      <Header studio={studio} />
      <main>
        <Hero studio={studio} />
        <Gallery studio={studio} />
        <Included studio={studio} />
        <Extras studio={studio} />
      </main>
      <Footer studio={studio} />
      <WhatsAppButton studio={studio} />
    </div>
  );
}

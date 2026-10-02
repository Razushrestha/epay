import { CategoryGrid } from "@/components/home/CategoryGrid";
import { DealsRow } from "@/components/home/DealsRow";
import { HeroSection } from "@/components/home/HeroSection";
import { PremiumBanner } from "@/components/home/PremiumBanner";
import { PromoBanner } from "@/components/home/PromoBanner";
import { TrendingRow } from "@/components/home/TrendingRow";
import { TrustBar } from "@/components/home/TrustBar";
import { SiteFooter } from "@/components/SiteFooter";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white pb-2">
      <HeroSection />
      <CategoryGrid />
      <PromoBanner />
      <DealsRow />
      <TrendingRow />
      <PremiumBanner />
      <TrustBar />
      <SiteFooter />
    </main>
  );
}

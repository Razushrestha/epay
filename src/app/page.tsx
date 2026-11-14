import { DealsRow } from "@/components/home/DealsRow";
import { HeroSection } from "@/components/home/HeroSection";
import { LatestListings } from "@/components/home/LatestListings";
import { TrustBar } from "@/components/home/TrustBar";
import { SiteFooter } from "@/components/SiteFooter";
import { CmsBanners } from "@/components/home/CmsBanners";
import { RecentlyViewed } from "@/components/browse/RecentlyViewed";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white pb-2">
      <HeroSection />
      <CmsBanners />
      <DealsRow />
      <LatestListings />
      <RecentlyViewed />
      <TrustBar />
      <SiteFooter />
    </main>
  );
}

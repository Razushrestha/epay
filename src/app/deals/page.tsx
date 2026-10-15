import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";
import { LiveDeals } from "@/components/home/LiveDeals";

export default function DealsPage() {
  return (
    <>
      <PageHero
        eyebrow="Deals"
        title="Today's Deals"
        body="Live discounted and featured listings from Nexlo sellers. Escrow still applies."
        cta="Browse all"
        href="/search"
      />
      <main className="page-shell py-8">
        <LiveDeals limit={24} />
      </main>
      <SiteFooter />
    </>
  );
}

import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms of service"
        body="The rules for buying, bidding, and selling on Nexlo — including escrow, fees, and returns."
        cta="Buyer protection"
        href="/help/buyer-protection"
      />
      <main className="page-shell py-8">
        <article className="nexlo-card max-w-3xl space-y-4 p-6 text-[14px] leading-relaxed text-[#333] sm:p-8">
          <p>By creating an account you agree to list only items you may sell, ship on time, and keep communication inside Nexlo.</p>
          <p>Buyers pay into escrow. Funds release after delivery or when the return window closes. Auction and Best Offer winners have 48 hours to pay.</p>
          <p>Returns follow the 30-day buyer protection window. Sellers have three days to respond before a case can escalate to Nexlo staff.</p>
          <p>Fees, prohibited items, and identity checks are described in the selling guide. We may pause listings or accounts that break those rules.</p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

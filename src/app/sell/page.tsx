import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";
import { TrustBar } from "@/components/home/TrustBar";

export default function SellPage() {
  return (
    <>
      <PageHero
        eyebrow="Sell on Nexlo"
        title="List it once. Reach every buyer in Nepal."
        body="Auction, Buy It Now, or Best Offer. Photos, category, and KYC come next — then your listing goes live with escrow on every sale."
        cta="Create a listing"
        href="/sell/create"
      />
      <main className="page-shell py-8">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Auction", "Proxy bids, increments, and a fair soft close."],
            ["Buy It Now", "Fixed price with optional Best Offer rules."],
            ["Get paid", "Escrow, fees, and payouts to bank, eSewa, or Khalti."],
          ].map(([title, text]) => (
            <div key={title} className="nexlo-card p-5">
              <p className="text-[15px] font-bold text-[#191919]">{title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#707070]">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/sell/listings" className="nexlo-link text-[13.5px]">Your listings →</Link>
          <Link href="/account?tab=selling" className="nexlo-link text-[13.5px]">Seller dashboard →</Link>
          <Link href="/help/selling-guide" className="nexlo-link text-[13.5px]">Selling guide →</Link>
        </div>
      </main>
      <TrustBar />
      <SiteFooter />
    </>
  );
}

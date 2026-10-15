import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";
import { TrustBar } from "@/components/home/TrustBar";

const steps = [
  { n: "1", title: "Create a listing", text: "Photos, category, item specifics, and Buy It Now, auction, or Best Offer." },
  { n: "2", title: "Go live", text: "Staff-approved listings appear in search with escrow on every sale." },
  { n: "3", title: "Ship and get paid", text: "Mark shipped, buyer confirms, then request a payout to bank, eSewa, or Khalti." },
];

const formats = [
  ["Auction", "Proxy bids, increments, and a fair soft close."],
  ["Buy It Now", "Fixed price with optional Best Offer rules."],
  ["Get paid", "Escrow, fees, and payouts after delivery."],
];

export default function SellPage() {
  return (
    <>
      <PageHero
        eyebrow="Sell on Nexlo"
        title="List it once. Reach every buyer in Nepal."
        body="Auction, Buy It Now, or Best Offer. Photos, category, and KYC come next, then your listing goes live with escrow on every sale."
        cta="Create a listing"
        href="/sell/create"
      />
      <main className="page-shell space-y-10 py-10">
        <section>
          <h2 className="text-[20px] font-extrabold text-[#0f1c3f]">How selling works</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {steps.map((step) => (
              <article key={step.n} className="nexlo-card p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3665f3] text-[13px] font-bold text-white">{step.n}</span>
                <h3 className="mt-3 text-[15px] font-bold text-[#0f1c3f]">{step.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[#5b6780]">{step.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="grid gap-3 sm:grid-cols-3">
          {formats.map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-[#e7eef6] bg-white p-5">
              <p className="text-[15px] font-bold text-[#0f1c3f]">{title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#5b6780]">{text}</p>
            </div>
          ))}
        </section>
        <div className="flex flex-wrap gap-3">
          <Link href="/sell/listings" className="nexlo-btn nexlo-btn-ghost">Your listings</Link>
          <Link href="/account?tab=selling" className="nexlo-link text-[13.5px] leading-10">Seller dashboard →</Link>
          <Link href="/help/selling-guide" className="nexlo-link text-[13.5px] leading-10">Selling guide →</Link>
        </div>
      </main>
      <TrustBar />
      <SiteFooter />
    </>
  );
}

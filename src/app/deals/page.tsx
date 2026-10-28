import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { LiveDeals } from "@/components/home/LiveDeals";

export default function DealsPage() {
  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <main className="page-shell py-5">
        <p className="text-[12.5px] text-[#98a2b3]">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-[#667085]">Deals</span>
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-[#0f1c3f] sm:text-[30px]">Today&apos;s Deals</h1>
            <p className="mt-1 text-[13px] text-[#6b7587]">Discounted and featured listings. Escrow still applies.</p>
          </div>
          <Link href="/search" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
            Browse all listings →
          </Link>
        </div>
        <div className="mt-5">
          <LiveDeals limit={24} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

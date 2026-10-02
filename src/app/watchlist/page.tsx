import Link from "next/link";
import { ListingGrid } from "@/components/browse/ListingGrid";
import { SiteFooter } from "@/components/SiteFooter";
import { listings } from "@/lib/home-data";

export default function WatchlistPage() {
  const saved = listings.filter((l) => l.format === "auction").slice(0, 4);
  return (
    <>
      <main className="mx-auto max-w-[1280px] px-4 py-6">
        <h1 className="text-[22px] font-bold text-[#191919]">Watchlist</h1>
        <p className="mt-1 text-[12.5px] text-[#707070]">
          Auctions you are following. You will be notified before they end.
        </p>
        <div className="mt-5">
          <ListingGrid items={saved} />
        </div>
        <Link href="/" className="mt-6 inline-block text-[13px] text-[#3665f3] hover:underline">
          ← Back to home
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";
import { WATCH_EVENT, loadWatchlist, toggleWatch, type WatchSnapshot } from "@/lib/commerce";

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setItems(await loadWatchlist());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    window.addEventListener(WATCH_EVENT, refresh);
    return () => window.removeEventListener(WATCH_EVENT, refresh);
  }, []);

  return (
    <>
      <PageHero
        eyebrow="Saved items"
        title="Watchlist"
        body="Items you save stay here so you can bid or buy when you are ready."
        cta="Find more to save"
        href="/search"
      />
      <main className="page-shell py-8">
        {loading ? (
          <p className="text-[14px] text-[#707070]">Loading watchlist…</p>
        ) : items.length === 0 ? (
          <div className="nexlo-card p-10 text-center">
            <p className="text-[16px] font-bold text-[#191919]">Nothing saved yet</p>
            <p className="mt-1 text-[14px] text-[#707070]">Tap the heart on a listing or deal to keep it here.</p>
            <Link href="/" className="nexlo-btn mt-5">
              Browse deals
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <article key={item.listing_id} className="nexlo-card relative overflow-hidden">
                <Link href={item.href || `/listing/${item.listing_id}`} className="block">
                  <span className="relative block aspect-[4/3] bg-[#f7f7f7]">
                    {item.photo_url ? (
                      <Image src={item.photo_url} alt={item.title} fill className="object-cover" sizes="240px" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[12px] text-[#707070]">No image</span>
                    )}
                  </span>
                  <span className="block p-3">
                    <span className="clamp-2 block min-h-[36px] text-[13px] font-medium text-[#191919]">{item.title}</span>
                    <span className="mt-2 block text-[15px] font-bold text-[#191919]">
                      {item.price ? `NPR ${item.price.toLocaleString("en-NP")}` : "View listing"}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#e53238] shadow-sm"
                  aria-label="Remove from watchlist"
                  onClick={async () => {
                    await toggleWatch({ listingId: item.listing_id, saved: true, title: item.title, photo: item.photo_url, price: item.price });
                    await refresh();
                  }}
                >
                  ♥
                </button>
              </article>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

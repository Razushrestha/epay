"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BuyShell, money } from "@/components/commerce/BuyShell";
import { WATCH_EVENT, loadWatchlist, toggleWatch, type WatchSnapshot } from "@/lib/commerce";
import { WatchlistIcon } from "@/components/commerce/WatchlistIcon";

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
    <BuyShell
      crumbs={[
        { href: "/", label: "Home" },
        { label: "Watchlist" },
      ]}
      title="Watchlist"
      body="Items you save stay here so you can bid or buy when you are ready."
      aside={
        <Link href="/search" className="nexlo-btn nexlo-btn-blue">
          Find more to save
        </Link>
      }
    >
      {loading ? (
        <p className="mt-8 text-[14px] text-[#6b7587]">Loading watchlist…</p>
      ) : items.length === 0 ? (
        <div className="nexlo-card mt-5 px-6 py-16 text-center">
          <h2 className="text-[18px] font-bold text-[#0f1c3f]">Nothing saved yet</h2>
          <p className="mt-2 text-[14px] text-[#6b7587]">Tap the heart on a listing or deal to keep it here.</p>
          <Link href="/search" className="nexlo-btn nexlo-btn-blue mt-5">
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <article key={item.listing_id} className="nexlo-card relative overflow-hidden">
              <Link href={item.href || `/listing/${item.listing_id}`} className="block">
                <span className="relative block aspect-[4/3] bg-[#f4f8fd]">
                  {item.photo_url ? (
                    <Image src={item.photo_url} alt={item.title} fill className="object-cover" sizes="240px" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[12px] text-[#6b7587]">No image</span>
                  )}
                </span>
                <span className="block p-3">
                  <span className="line-clamp-2 block min-h-[36px] text-[13px] font-medium text-[#0f1c3f]">{item.title}</span>
                  <span className="mt-2 block text-[15px] font-bold text-[#0f1c3f]">
                    {item.price != null ? money(item.price) : "View listing"}
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
                <WatchlistIcon saved size={16} />
              </button>
            </article>
          ))}
        </div>
      )}
    </BuyShell>
  );
}

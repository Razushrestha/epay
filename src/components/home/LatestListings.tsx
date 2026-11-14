"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiBase } from "@/lib/account-api";
import { SaveButton } from "@/components/commerce/SaveButton";

type Item = {
  id: number;
  title: string;
  format?: string;
  price: number | null;
  compare_at?: number | null;
  auction_current_price?: number | null;
  auction_bid_count?: number | null;
  primary_photo: string | null;
  shipping_free?: boolean;
  category_name?: string | null;
};

const PAGE_SIZE = 12;

function money(n: number) {
  return `NPR ${Number(n || 0).toLocaleString("en-NP")}`;
}

/** Newest live listings, straight from the same feed the search page and admin use. */
export function LatestListings() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/listings?limit=${PAGE_SIZE}&offset=${offset}&sort=newest`);
      if (!res.ok) throw new Error("bad response");
      const body = (await res.json()) as { listings?: Item[]; total?: number };
      setItems((current) => (offset === 0 ? body.listings || [] : [...current, ...(body.listings || [])]));
      setTotal(Number(body.total || 0));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch on mount; setState happens after the awaited response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(0);
  }, [load]);

  if (!items.length && !loading) {
    return failed ? (
      <section className="page-shell pt-8">
        <p className="rounded-xl border border-[#e7eef6] bg-[#f7fafd] p-4 text-[13px] text-[#6b7587]">
          Listings could not be loaded right now. Please refresh in a moment.
        </p>
      </section>
    ) : null;
  }

  return (
    <section className="page-shell pt-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[22px] font-extrabold tracking-tight text-[#0f1c3f]">Latest listings</h2>
          {total ? <p className="mt-[2px] text-[12px] text-[#6b7587]">{total.toLocaleString()} items live now</p> : null}
        </div>
        <Link href="/search" className="shrink-0 text-[13.5px] font-medium text-[#3665f3] hover:underline">
          View all →
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((item) => {
          const price = Number(item.auction_current_price || item.price || 0);
          const was = Number(item.compare_at || 0);
          const off = was > price && price > 0 ? Math.round(((was - price) / was) * 100) : 0;
          const isAuction = item.format === "auction" || item.format === "both";
          return (
            <article key={item.id} className="group relative overflow-hidden rounded-xl border border-[#e7eef6] bg-white">
              <Link href={`/listing/${item.id}`} className="block">
                <span className="relative block bg-[#f4f8fd]">
                  {item.primary_photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.primary_photo} alt="" className="aspect-[17/13] w-full object-cover" loading="lazy" />
                  ) : (
                    <Image src="/logo.png" alt="" width={340} height={260} className="aspect-[17/13] w-full object-contain p-8" />
                  )}
                  {off > 0 ? (
                    <span className="absolute left-2 top-2 rounded bg-[#e53238] px-1.5 py-[2px] text-[10px] font-bold text-white">
                      {off}% OFF
                    </span>
                  ) : isAuction ? (
                    <span className="absolute left-2 top-2 rounded bg-[#0f1c3f] px-1.5 py-[2px] text-[10px] font-bold text-white">
                      Auction
                    </span>
                  ) : null}
                </span>
                <span className="block p-2.5">
                  {item.category_name ? (
                    <span className="block truncate text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[#8a94a6]">
                      {item.category_name}
                    </span>
                  ) : null}
                  <span className="line-clamp-2 min-h-[32px] text-[12.5px] font-medium text-[#0f1c3f]">{item.title}</span>
                  <span className="mt-1.5 block text-[15px] font-bold">{money(price)}</span>
                  {off > 0 ? (
                    <span className="text-[11px] text-[#6b7587] line-through">{money(was)}</span>
                  ) : isAuction && item.auction_bid_count ? (
                    <span className="text-[11px] text-[#6b7587]">
                      {item.auction_bid_count} bid{item.auction_bid_count === 1 ? "" : "s"}
                    </span>
                  ) : item.shipping_free ? (
                    <span className="text-[11px] text-[#008638]">Free shipping</span>
                  ) : null}
                </span>
              </Link>
              <SaveButton listingId={item.id} title={item.title} photo={item.primary_photo} price={price} className="absolute right-2 top-1.5 z-10" />
            </article>
          );
        })}
      </div>

      {items.length < total ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => void load(items.length)}
            className="rounded-full border border-[#c7d3e6] bg-white px-6 py-2.5 text-[13.5px] font-semibold text-[#3665f3] hover:bg-[#f4f8fd] disabled:opacity-60"
          >
            {loading ? "Loading…" : `Show more (${(total - items.length).toLocaleString()} left)`}
          </button>
        </div>
      ) : null}
    </section>
  );
}

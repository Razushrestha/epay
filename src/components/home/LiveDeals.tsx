"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiBase } from "@/lib/account-api";
import { SaveButton } from "@/components/commerce/SaveButton";

type Deal = {
  id: number;
  title: string;
  price: number | null;
  compare_at?: number | null;
  auction_current_price?: number | null;
  primary_photo: string | null;
  shipping_free?: boolean;
};

function money(n: number) {
  return `NPR ${Number(n || 0).toLocaleString("en-NP")}`;
}

export function LiveDeals({ limit = 12, compact = false }: { limit?: number; compact?: boolean }) {
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    fetch(`${apiBase}/api/v1/listings/deals?limit=${limit}`)
      .then((res) => res.json())
      .then((body) => setDeals(body.listings || []))
      .catch(() => setDeals([]));
  }, [limit]);

  if (!deals.length) {
    return compact ? null : (
      <p className="py-10 text-center text-[14px] text-[#6b7587]">No live deals right now. Check back after sellers mark a compare-at price or feature a listing.</p>
    );
  }

  return (
    <div className={compact ? "no-scrollbar mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" : "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"}>
      {deals.map((deal) => {
        const price = Number(deal.auction_current_price || deal.price || 0);
        const was = Number(deal.compare_at || 0);
        const off = was > price && price > 0 ? Math.round(((was - price) / was) * 100) : 0;
        return (
          <article key={deal.id} className="group relative overflow-hidden rounded-xl border border-[#e7eef6] bg-white">
            <Link href={`/listing/${deal.id}`} className="block">
              <span className="relative block bg-[#f4f8fd]">
                {deal.primary_photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={deal.primary_photo} alt="" className="aspect-[17/13] w-full object-cover" />
                ) : (
                  <Image src="/logo.png" alt="" width={340} height={260} className="aspect-[17/13] w-full object-contain p-8" />
                )}
                {off > 0 ? (
                  <span className="absolute left-2 top-2 rounded bg-[#e53238] px-1.5 py-[2px] text-[10px] font-bold text-white">
                    {off}% OFF
                  </span>
                ) : null}
              </span>
              <span className="block p-2.5">
                <span className="line-clamp-2 min-h-[32px] text-[12.5px] font-medium text-[#0f1c3f]">{deal.title}</span>
                <span className="mt-1.5 block text-[15px] font-bold">{money(price)}</span>
                {off > 0 ? (
                  <span className="text-[11px] text-[#6b7587] line-through">{money(was)}</span>
                ) : deal.shipping_free ? (
                  <span className="text-[11px] text-[#008638]">Free shipping</span>
                ) : null}
              </span>
            </Link>
            <SaveButton listingId={deal.id} title={deal.title} photo={deal.primary_photo} price={price} className="absolute right-2 top-1.5 z-10" />
          </article>
        );
      })}
    </div>
  );
}

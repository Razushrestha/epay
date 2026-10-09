"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi, getToken } from "@/lib/account-api";

type Item = {
  id: number;
  title: string;
  price: number | string | null;
  primary_photo: string | null;
};

export function RecentlyViewed({ compact = false }: { compact?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!getToken()) return;
    accountApi<{ listings: Item[] }>("/api/v1/listings/recent")
      .then((body) => setItems(body.listings || []))
      .catch(() => undefined);
  }, []);

  if (!items.length) return null;

  return (
    <section className={compact ? "mt-4 nexlo-card p-6" : "page-shell pt-8"}>
      <h2 className={compact ? "text-[16px] font-bold" : "text-[22px] font-bold tracking-tight text-[#1a2744]"}>
        Recently viewed
      </h2>
      <div className={`mt-4 grid gap-3 ${compact ? "sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-4 xl:grid-cols-8"}`}>
        {items.slice(0, compact ? 8 : 8).map((item) => (
          <Link key={item.id} href={`/listing/${item.id}`} className="group min-w-0">
            <span className="relative block aspect-square overflow-hidden rounded-2xl bg-[#f3f5f8]">
              {item.primary_photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.primary_photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-[11px] text-[#8a94a6]">No photo</span>
              )}
            </span>
            <span className="mt-2 line-clamp-2 block text-[13px] text-[#191919]">{item.title}</span>
            {item.price != null ? (
              <span className="text-[12px] text-[#6b7587]">NPR {Number(item.price).toLocaleString("en-NP")}</span>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}

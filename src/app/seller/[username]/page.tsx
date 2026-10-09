"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiBase } from "@/lib/account-api";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";
import { SaveButton } from "@/components/commerce/SaveButton";

type Row = {
  id: number;
  title: string;
  price: number | null;
  auction_current_price?: number | null;
  format: string;
  primary_photo: string | null;
};

export default function SellerStorePage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username || "");
  const [listings, setListings] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${apiBase}/api/v1/listings?seller=${encodeURIComponent(username)}&limit=48`)
      .then((res) => res.json())
      .then((body) => setListings(body.listings || []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [username]);

  return (
    <>
      <PageHero
        eyebrow="Seller"
        title={username || "Seller"}
        body="Active listings from this seller. Escrow and buyer protection apply on every order."
        cta="Browse all"
        href="/search"
      />
      <main className="page-shell py-8">
        {loading ? (
          <p className="text-[14px] text-[#707070]">Loading store…</p>
        ) : listings.length === 0 ? (
          <div className="nexlo-card p-10 text-center">
            <p className="text-[16px] font-bold text-[#191919]">No live listings right now</p>
            <p className="mt-1 text-[14px] text-[#707070]">This seller may be on vacation or still setting up.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {listings.map((item) => (
              <article key={item.id} className="nexlo-card relative overflow-hidden">
                <Link href={`/listing/${item.id}`} className="block">
                  <span className="relative block aspect-square bg-[#f7f7f7]">
                    {item.primary_photo ? (
                      <img src={item.primary_photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Image src="/logo.png" alt="" fill className="object-contain p-8" />
                    )}
                  </span>
                  <span className="block p-3">
                    <span className="clamp-2 block min-h-[36px] text-[13px] font-medium text-[#191919]">{item.title}</span>
                    <span className="mt-2 block text-[15px] font-bold">
                      NPR {Number(item.auction_current_price || item.price || 0).toLocaleString("en-NP")}
                    </span>
                  </span>
                </Link>
                <SaveButton listingId={item.id} title={item.title} photo={item.primary_photo} price={item.price || 0} className="absolute right-2 top-2 z-10" />
              </article>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

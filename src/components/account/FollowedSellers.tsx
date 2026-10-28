"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { AccountEmpty, AccountSection } from "@/components/account/AccountChrome";

type Follow = {
  seller_id: number;
  public_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  seller_level: string;
  listing_count: number;
};

export function FollowedSellers() {
  const [rows, setRows] = useState<Follow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const body = await accountApi<{ data: Follow[] }>("/api/v1/account/follows");
    setRows(body.data || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load followed sellers"));
  }, []);

  return (
    <AccountSection title="Followed sellers" body="Sellers you follow from listing pages.">
      {error ? <p className="nexlo-alert nexlo-alert-error mb-4">{error}</p> : null}
      {rows.length === 0 ? (
        <AccountEmpty
          title="You are not following any sellers yet"
          body="Follow a seller from a listing or storefront to see them here."
          action={
            <Link href="/search" className="nexlo-btn nexlo-btn-blue">
              Browse listings
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const handle = row.username || row.public_id;
            const name = row.display_name || row.username || "Seller";
            return (
              <li key={row.seller_id} className="nexlo-card flex items-center gap-3 p-4">
                {row.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e8eefc] text-[14px] font-bold text-[#3665f3]">
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/seller/${encodeURIComponent(handle)}`} className="font-semibold text-[#0f1c3f] hover:underline">
                    {name}
                  </Link>
                  <p className="text-[12.5px] text-[#6b7587]">
                    {row.listing_count} active listing{row.listing_count === 1 ? "" : "s"} · {row.seller_level.replace(/_/g, " ")}
                  </p>
                </div>
                <button
                  type="button"
                  className="nexlo-btn-ghost h-9 rounded-full border border-[#e2e8f0] px-4 text-[12.5px] font-semibold text-[#e5484d] hover:bg-[#fff5f5] hover:text-[#e5484d]"
                  onClick={async () => {
                    await accountApi("/api/v1/account/follow", {
                      method: "DELETE",
                      body: JSON.stringify({ sellerId: row.seller_id }),
                    });
                    await load();
                  }}
                >
                  Unfollow
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AccountSection>
  );
}

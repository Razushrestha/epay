"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";

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
    <section className="nexlo-card p-6">
      <h1 className="text-[22px] font-extrabold text-[#0f1c3f]">Followed sellers</h1>
      <p className="mt-1 text-[13px] text-[#667085]">Sellers you follow from listing pages.</p>
      {error ? <p className="mt-3 text-[13px] text-red-700">{error}</p> : null}
      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          const handle = row.username || row.public_id;
          const name = row.display_name || row.username || "Seller";
          return (
            <li key={row.seller_id} className="flex items-center gap-3 rounded-xl border border-[#eef2f7] px-3 py-3">
              {row.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e8eefc] text-[14px] font-bold text-[#3665f3]">
                  {name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <Link href={`/seller/${encodeURIComponent(handle)}`} className="font-semibold text-[#0f1c3f] hover:underline">
                  {name}
                </Link>
                <p className="text-[12.5px] text-[#6b7587]">
                  {row.listing_count} active listings · {row.seller_level.replace(/_/g, " ")}
                </p>
              </div>
              <button
                type="button"
                className="text-[12.5px] font-semibold text-[#e5484d]"
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
        {!rows.length ? <li className="text-[13px] text-[#8a94a6]">You are not following any sellers yet.</li> : null}
      </ul>
    </section>
  );
}

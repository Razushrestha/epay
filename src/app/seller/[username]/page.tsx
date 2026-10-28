"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { accountApi, apiBase, getToken } from "@/lib/account-api";
import { BuyShell } from "@/components/commerce/BuyShell";
import { SaveButton } from "@/components/commerce/SaveButton";
import { DsrBars } from "@/components/seller/DsrBars";

type Row = {
  id: number;
  title: string;
  price: number | null;
  auction_current_price?: number | null;
  format: string;
  primary_photo: string | null;
};

type Member = {
  id: string;
  sellerId: number;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  country: string | null;
  sellerLevel: string;
  isSeller: boolean;
  memberSince: string;
  listingCount: number;
  followerCount: number;
  feedback: { positive: number; neutral: number; negative: number };
  recentFeedback: { rating: string; comment: string | null; created_at: string; from_name: string }[];
  dsr?: { count: number; item: number | null; communication: number | null; shipping_time: number | null; shipping_cost: number | null };
};

export default function SellerStorePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const username = decodeURIComponent(params.username || "");
  const [messageBusy, setMessageBusy] = useState(false);
  const [listings, setListings] = useState<Row[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [memberRes, listRes] = await Promise.all([
          fetch(`${apiBase}/api/v1/members/${encodeURIComponent(username)}`),
          fetch(`${apiBase}/api/v1/listings?seller=${encodeURIComponent(username)}&limit=48`),
        ]);
        const memberBody = await memberRes.json().catch(() => ({}));
        const listBody = await listRes.json().catch(() => ({}));
        if (cancelled) return;
        setMember(memberBody.member || null);
        setListings(listBody.listings || []);
        if (getToken() && memberBody.member?.sellerId) {
          const status = await accountApi<{ following: boolean }>(`/api/v1/account/follow/${memberBody.member.sellerId}`).catch(() => ({ following: false }));
          setFollowing(Boolean(status.following));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [username]);

  const name = member?.displayName || username || "Seller";
  const reviews = member ? member.feedback.positive + member.feedback.neutral + member.feedback.negative : 0;
  const positive = reviews ? Math.round((member!.feedback.positive / reviews) * 100) : null;
  const year = member?.memberSince ? new Date(member.memberSince).getFullYear() : null;

  return (
    <BuyShell
      crumbs={[
        { href: "/", label: "Home" },
        { href: "/search", label: "Browse" },
        { label: name },
      ]}
      title={name}
      body={member?.bio || "Active listings, feedback, and seller standing."}
      aside={
        member?.sellerId && getToken() ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="nexlo-btn nexlo-btn-ghost h-10"
              onClick={async () => {
                const next = !following;
                await accountApi("/api/v1/account/follow", {
                  method: next ? "POST" : "DELETE",
                  body: JSON.stringify({ sellerId: member.sellerId }),
                });
                setFollowing(next);
              }}
            >
              {following ? "Following" : "Follow"}
            </button>
            <button
              type="button"
              disabled={messageBusy}
              className="nexlo-btn nexlo-btn-blue h-10 disabled:opacity-60"
              onClick={async () => {
                setMessageBusy(true);
                try {
                  const convo = await accountApi<{ data: { id: number } }>("/api/v1/conversations", {
                    method: "POST",
                    body: JSON.stringify({ memberId: member.sellerId, subject: `Message for ${name}` }),
                  });
                  router.push(`/account?tab=messages&thread=${convo.data.id}`);
                } finally {
                  setMessageBusy(false);
                }
              }}
            >
              {messageBusy ? "Opening…" : "Contact"}
            </button>
          </div>
        ) : (
          <Link href="/search" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
            Browse all →
          </Link>
        )
      }
    >
      <section className="nexlo-card mt-5 flex flex-wrap items-center gap-4 p-5">
        {member?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e8eefc] text-[20px] font-extrabold text-[#3665f3]">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-[#6b7587]">
            {member?.country || "Nepal"}
            {year ? ` · Member since ${year}` : ""}
            {member ? ` · ${member.sellerLevel.replace(/_/g, " ")}` : ""}
          </p>
          <p className="mt-1 text-[13px] text-[#3a4a66]">
            {reviews ? `${positive}% positive · ${reviews} reviews` : "No feedback yet"}
            {member
              ? ` · ${member.listingCount} listing${member.listingCount === 1 ? "" : "s"} · ${member.followerCount} follower${member.followerCount === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
      </section>

      {member ? (
        <section className="nexlo-card mt-4 p-5">
          <h2 className="text-[16px] font-bold text-[#0f1c3f]">Detailed seller ratings</h2>
          <div className="mt-3 max-w-md">
            <DsrBars dsr={member.dsr} />
          </div>
        </section>
      ) : null}

      {member?.recentFeedback?.length ? (
        <section className="nexlo-card mt-4 p-5">
          <h2 className="text-[16px] font-bold text-[#0f1c3f]">Recent feedback</h2>
          <ul className="mt-3 space-y-2 text-[13px]">
            {member.recentFeedback.slice(0, 8).map((item, i) => (
              <li key={`${item.created_at}-${i}`} className="rounded-xl bg-[#f7f9fc] px-3 py-2">
                <span className="font-semibold capitalize">{item.rating}</span>
                {item.comment ? ` — ${item.comment}` : ""}
                <span className="block text-[12px] text-[#8a94a6]">{item.from_name}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <h2 className="mt-6 text-[16px] font-bold text-[#0f1c3f]">Items for sale</h2>
      {loading ? (
        <p className="mt-4 text-[14px] text-[#6b7587]">Loading store…</p>
      ) : listings.length === 0 ? (
        <div className="nexlo-card mt-4 p-10 text-center">
          <p className="text-[16px] font-bold text-[#0f1c3f]">No live listings right now</p>
          <p className="mt-1 text-[14px] text-[#6b7587]">This member may be buying only, on vacation, or still setting up.</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {listings.map((item) => (
            <article key={item.id} className="nexlo-card group relative overflow-hidden hover:border-[#c9d8ff]">
              <Link href={`/listing/${item.id}`} className="block">
                <span className="relative block bg-[#f4f8fd]">
                  {item.primary_photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.primary_photo} alt="" className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <Image src="/logo.png" alt="" width={340} height={260} className="aspect-[4/3] w-full object-contain p-8" />
                  )}
                </span>
                <span className="block p-3">
                  <span className="clamp-2 block min-h-[36px] text-[13px] font-medium text-[#0f1c3f] group-hover:text-[#3665f3]">{item.title}</span>
                  <span className="mt-1.5 block text-[16px] font-extrabold text-[#0f1c3f]">
                    NPR {Number(item.auction_current_price || item.price || 0).toLocaleString("en-NP")}
                  </span>
                  <span className="mt-1 block text-[11.5px] text-[#6b7587]">{item.format === "auction" ? "Auction" : "Buy It Now"}</span>
                </span>
              </Link>
              <SaveButton listingId={item.id} title={item.title} photo={item.primary_photo} price={item.price || 0} className="absolute right-2 top-1.5 z-10" />
            </article>
          ))}
        </div>
      )}
    </BuyShell>
  );
}

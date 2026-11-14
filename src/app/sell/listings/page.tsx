"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { accountApi, apiBase } from "@/lib/account-api";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

interface Listing {
  id: number;
  title: string;
  format: string;
  price: number | null;
  quantity: number;
  status: string;
  auction_current_price: number | null;
  auction_bid_count: number;
  view_count: number;
  watch_count: number;
  created_at: string;
  published_at: string | null;
  category_name: string;
  primary_photo: string | null;
}

function prettyTitle(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function formatPrice(price: number | null) {
  if (price === null) return "N/A";
  return `NPR ${Number(price).toLocaleString("en-NP")}`;
}

const STAT_ICONS: Record<"bolt" | "box" | "file" | "eye" | "heart", ReactNode> = {
  bolt: (
    <>
      <path d="M3.5 3.5h8.2l9 9a1.4 1.4 0 0 1 0 2L14.5 20.7a1.4 1.4 0 0 1-2 0l-9-9V3.5Z" />
      <circle cx="7.9" cy="7.9" r="1.3" />
    </>
  ),
  box: (
    <>
      <path d="M5.2 8.2h13.6l-.9 11.6a1 1 0 0 1-1 .9H7.1a1 1 0 0 1-1-.9L5.2 8.2Z" />
      <path d="M9 8.2V6.8a3 3 0 0 1 6 0v1.4" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7.5a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7l-4-4Z" />
      <path d="M14 3v4h4M9.5 12.5h5M9.5 16h3.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  heart: <path d="M12 20.5s-7.5-4.6-9-9.4C2 8 3.8 5.2 6.8 5.2c1.9 0 3.5 1 5.2 3 1.7-2 3.3-3 5.2-3 3 0 4.8 2.8 3.8 5.9-1.5 4.8-9 9.4-9 9.4Z" />,
};

function StatCard({
  value,
  label,
  icon,
  onClick,
}: {
  value: number | string;
  label: string;
  icon: "bolt" | "box" | "file" | "eye" | "heart";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl border border-[#e7eef6] bg-white px-4 py-4 text-left shadow-[0_8px_24px_-18px_rgba(15,28,63,0.35)] transition hover:border-[#cfdbec]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef2f8] text-[#0f1c3f] transition group-hover:bg-[#e4eaf4]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {STAT_ICONS[icon]}
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[22px] font-extrabold leading-none text-[#0f1c3f]">{value}</span>
        <span className="mt-1 block text-[12.5px] text-[#6b7587]">{label}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c5cedb" strokeWidth="2" aria-hidden>
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
}

export default function SellerListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState<"grid" | "list">("list");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    active_count: 0,
    sold_count: 0,
    draft_count: 0,
    total_views: 0,
    total_watches: 0,
  });

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab") || new URLSearchParams(window.location.search).get("status");
    if (tab === "draft" || tab === "drafts") setFilter("draft");
  }, []);

  useEffect(() => {
    loadListings();
    loadAnalytics();
  }, [filter]);

  async function loadListings() {
    setLoading(true);
    setError(null);
    try {
      const token = accountApi.getToken();
      if (!token) {
        window.location.href = "/login?redirect=/sell/listings";
        return;
      }

      const res = await fetch(`${apiBase}/api/v1/listings/seller/listings?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load listings");

      const data = await res.json();
      setListings(data.listings || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load listings");
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics() {
    try {
      const token = accountApi.getToken();
      if (!token) return;

      const res = await fetch(`${apiBase}/api/v1/listings/seller/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || {});
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    }
  }

  async function handleEndListing(listingId: number) {
    if (!confirm("Are you sure you want to end this listing?")) return;
    try {
      const token = accountApi.getToken();
      if (!token) return;
      const res = await fetch(`${apiBase}/api/v1/listings/${listingId}/end`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to end listing");
      setFilter("ended");
      loadListings();
      loadAnalytics();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not end listing");
    }
  }

  async function handleRelistListing(listingId: number) {
    try {
      const token = accountApi.getToken();
      if (!token) return;
      const res = await fetch(`${apiBase}/api/v1/listings/${listingId}/relist`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to relist listing");
      setFilter("active");
      loadListings();
      loadAnalytics();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not relist listing");
    }
  }

  async function handleDeleteListing(listingId: number) {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    try {
      const token = accountApi.getToken();
      if (!token) return;
      const res = await fetch(`${apiBase}/api/v1/listings/${listingId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete listing");
      loadListings();
      loadAnalytics();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete listing");
    }
  }

  async function handlePublishListing(listingId: number) {
    try {
      const token = accountApi.getToken();
      if (!token) return;
      const res = await fetch(`${apiBase}/api/v1/listings/${listingId}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to publish listing");
      loadListings();
      loadAnalytics();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not publish listing");
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = listings.filter((item) => !q || item.title.toLowerCase().includes(q) || item.category_name?.toLowerCase().includes(q));
    return rows.sort((a, b) => {
      if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === "price") return Number(b.auction_current_price || b.price || 0) - Number(a.auction_current_price || a.price || 0);
      if (sort === "views") return Number(b.view_count) - Number(a.view_count);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [listings, query, sort]);

  const active = Number(stats.active_count || 0);

  function actions(listing: Listing) {
    return (
      <div className="flex flex-wrap justify-end gap-3 text-[13px]">
        {listing.status === "draft" ? (
          <button type="button" onClick={() => handlePublishListing(listing.id)} className="font-semibold text-[#3665f3]">Publish</button>
        ) : null}
        {listing.status === "active" ? (
          <button type="button" onClick={() => handleEndListing(listing.id)} className="font-semibold text-[#8a6d1f]">End Listing</button>
        ) : null}
        {listing.status === "ended" || listing.status === "sold" ? (
          <button type="button" onClick={() => handleRelistListing(listing.id)} className="font-semibold text-[#16a34a]">Relist</button>
        ) : null}
        <Link href={`/sell/edit/${listing.id}`} className="font-semibold text-[#3665f3]">Edit</Link>
        <button type="button" onClick={() => handleDeleteListing(listing.id)} className="font-semibold text-[#e53238]">Delete</button>
      </div>
    );
  }

  function statusBadge(status: string) {
    const colors: Record<string, string> = {
      active: "bg-[#dcfce7] text-[#15803d]",
      draft: "bg-[#f3f4f6] text-[#6b7280]",
      sold: "bg-[#eef3ff] text-[#3665f3]",
      ended: "bg-[#fff8e7] text-[#8a6d1f]",
      removed: "bg-[#fff5f5] text-[#e53238]",
    };
    return (
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors[status] || "bg-[#f3f4f6] text-[#6b7280]"}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-[#f6f7f9]">
        <div className="page-shell py-5">
          <p className="text-[12.5px] text-[#98a2b3]">
            <Link href="/" className="hover:underline">Home</Link>
            <span className="mx-1.5">›</span>
            <Link href="/sell" className="hover:underline">Sell</Link>
            <span className="mx-1.5">›</span>
            <span className="text-[#667085]">Listings</span>
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-extrabold tracking-tight text-[#0f1c3f] sm:text-[30px]">Your listings</h1>
              <p className="mt-1 text-[13px] text-[#6b7587]">
                {active} active listing{active === 1 ? "" : "s"} · Manage items, track views, and go live from here.
              </p>
            </div>
            <Link href="/sell/create" className="nexlo-btn nexlo-btn-blue">
              Create a listing
            </Link>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-[#f5c2c7] bg-[#fff5f5] px-4 py-3 text-[14px] text-[#e53238]">{error}</div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard value={active} label="Active listings" icon="bolt" onClick={() => setFilter("active")} />
            <StatCard value={Number(stats.sold_count || 0)} label="Sold items" icon="box" onClick={() => setFilter("sold")} />
            <StatCard value={Number(stats.draft_count || 0)} label="Drafts" icon="file" onClick={() => setFilter("draft")} />
            <StatCard value={Number(stats.total_views || 0).toLocaleString()} label="Views" icon="eye" onClick={() => setFilter("all")} />
            <StatCard value={Number(stats.total_watches || 0).toLocaleString()} label="Watchers" icon="heart" onClick={() => setFilter("all")} />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {["all", "active", "draft", "sold", "ended"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`h-9 rounded-full px-4 text-[13px] font-semibold ${
                    filter === tab ? "bg-[#0f1c3f] text-white" : "bg-white text-[#5b6780] hover:bg-[#eef3f9]"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-4">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a94a6" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your listings..."
                className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-[#8a94a6]"
              />
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-10 rounded-full border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#0f1c3f]"
            >
              <option value="newest">Sort: Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="price">Price: high to low</option>
              <option value="views">Most viewed</option>
            </select>
            <div className="flex h-10 overflow-hidden rounded-full border border-[#e2e8f0] bg-white">
              <button type="button" aria-label="Grid view" onClick={() => setView("grid")} className={`flex w-10 items-center justify-center ${view === "grid" ? "bg-[#0f1c3f] text-white" : "text-[#8a94a6]"}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" /></svg>
              </button>
              <button type="button" aria-label="List view" onClick={() => setView("list")} className={`flex w-10 items-center justify-center ${view === "list" ? "bg-[#0f1c3f] text-white" : "text-[#8a94a6]"}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" /></svg>
              </button>
            </div>
          </div>

          <section className="mt-4 rounded-3xl border border-[#e7eef6] bg-white px-4 py-10 sm:px-6">
            {loading ? (
              <p className="py-8 text-center text-[14px] text-[#6b7587]">Loading…</p>
            ) : visible.length === 0 ? (
              <div className="mx-auto max-w-md py-6 text-center">
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
                  <span className="absolute -right-1 -top-1 text-[#93c5fd]">✦</span>
                  <span className="absolute -left-2 top-1 text-[10px] text-[#93c5fd]">✦</span>
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f0ff] text-[#3665f3]">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                      <path d="M20 13 11 4H4v7l9 9 7-7Z" />
                      <circle cx="7.5" cy="7.5" r="1" />
                    </svg>
                  </span>
                </div>
                <p className="mt-4 text-[16px] font-bold text-[#0f1c3f]">No listings in this view.</p>
                <p className="mt-1 text-[13.5px] text-[#6b7587]">Start selling your first item and reach millions of buyers worldwide.</p>
                <Link href="/sell/create" className="mt-5 inline-flex h-11 items-center rounded-full bg-[#0f1c3f] px-5 text-[13.5px] font-semibold text-white">
                  Create your first listing →
                </Link>
              </div>
            ) : view === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((listing) => (
                  <article key={listing.id} className="rounded-2xl border border-[#e7eef6] p-3">
                    <Link href={listing.status === "draft" ? `/sell/edit/${listing.id}` : `/listing/${listing.id}`} className="block overflow-hidden rounded-xl bg-[#f4f7fb]">
                      {listing.primary_photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={listing.primary_photo} alt="" className="h-40 w-full object-cover" />
                      ) : (
                        <div className="flex h-40 items-center justify-center text-[12px] text-[#8a94a6]">No photo</div>
                      )}
                    </Link>
                    <div className="mt-3 flex items-start justify-between gap-2">
                      <div>
                        <Link href={listing.status === "draft" ? `/sell/edit/${listing.id}` : `/listing/${listing.id}`} className="text-[14px] font-bold text-[#0f1c3f] hover:text-[#3665f3]">
                          {prettyTitle(listing.title)}
                        </Link>
                        <p className="text-[12px] text-[#6b7587]">{listing.category_name}</p>
                      </div>
                      {statusBadge(listing.status)}
                    </div>
                    <p className="mt-2 text-[15px] font-extrabold text-[#0f1c3f]">
                      {listing.format === "auction" && listing.auction_current_price
                        ? formatPrice(listing.auction_current_price)
                        : formatPrice(listing.price)}
                    </p>
                    <p className="mt-1 text-[12px] text-[#6b7587]">{listing.view_count} views · {listing.watch_count} watchers</p>
                    <div className="mt-3">{actions(listing)}</div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase tracking-wider text-[#8a94a6]">
                      <th className="px-2 py-3">Listing</th>
                      <th className="px-2 py-3">Format</th>
                      <th className="px-2 py-3">Price</th>
                      <th className="px-2 py-3">Status</th>
                      <th className="px-2 py-3">Views / watchers</th>
                      <th className="px-2 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef2f7]">
                    {visible.map((listing) => (
                      <tr key={listing.id}>
                        <td className="px-2 py-4">
                          <div className="flex items-center gap-3">
                            {listing.primary_photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={listing.primary_photo} alt="" className="h-14 w-14 rounded-xl object-cover" />
                            ) : (
                              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#f4f7fb] text-[11px] text-[#8a94a6]">No photo</span>
                            )}
                            <div>
                              <Link href={listing.status === "draft" ? `/sell/edit/${listing.id}` : `/listing/${listing.id}`} className="text-[14px] font-semibold text-[#0f1c3f] hover:text-[#3665f3]">
                                {prettyTitle(listing.title)}
                              </Link>
                              <div className="text-[12px] text-[#6b7587]">{listing.category_name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-4 text-[13px] text-[#6b7587]">
                          {listing.format === "fixed" && "Buy It Now"}
                          {listing.format === "auction" && "Auction"}
                          {listing.format === "both" && "Auction + BIN"}
                        </td>
                        <td className="px-2 py-4 text-[13px] text-[#0f1c3f]">
                          {listing.format === "auction" && listing.auction_current_price
                            ? formatPrice(listing.auction_current_price)
                            : formatPrice(listing.price)}
                          {listing.format === "auction" ? (
                            <div className="text-[11px] text-[#6b7587]">{listing.auction_bid_count} bids</div>
                          ) : null}
                        </td>
                        <td className="px-2 py-4">{statusBadge(listing.status)}</td>
                        <td className="px-2 py-4 text-[13px] text-[#6b7587]">
                          {listing.view_count} / {listing.watch_count}
                        </td>
                        <td className="px-2 py-4 text-right">{actions(listing)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

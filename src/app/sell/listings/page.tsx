"use client";

import { useState, useEffect } from "react";
import { accountApi, apiBase } from "@/lib/account-api";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";

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

export default function SellerListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filter, setFilter] = useState<string>("all");
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
    } catch (err: any) {
      setError(err.message);
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

      loadListings();
      loadAnalytics();
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
    }
  }

  function formatPrice(price: number | null) {
    if (price === null) return "N/A";
    return `NPR ${price.toLocaleString()}`;
  }

  function getStatusBadge(status: string) {
    const colors: Record<string, string> = {
      active: "bg-[#d1fae5] text-[#0d9488]",
      draft: "bg-[#f7f7f7] text-[#707070]",
      sold: "bg-[#eef3ff] text-[#3665f3]",
      ended: "bg-[#fff8e7] text-[#8a6d1f]",
      removed: "bg-[#fff5f5] text-[#e53238]",
    };

    return (
      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${colors[status] || "bg-[#f7f7f7] text-[#707070]"}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Seller hub"
        title="Your listings"
        body="Active, draft, and sold items in one place. Publish drafts, end auctions, or start a new listing."
        cta="Create listing"
        href="/sell/create"
      />
      <main className="page-shell py-8">
        {error ? (
          <div className="mb-6 rounded-xl border border-[#f5c2c7] bg-[#fff5f5] p-4 text-[14px] text-[#e53238]">
            {error}
          </div>
        ) : null}

        <div className="mb-6 grid gap-3 sm:grid-cols-5">
          {[
            [stats.active_count, "Active"],
            [stats.sold_count, "Sold"],
            [stats.draft_count, "Drafts"],
            [stats.total_views?.toLocaleString() || 0, "Views"],
            [stats.total_watches?.toLocaleString() || 0, "Watches"],
          ].map(([value, label]) => (
            <div key={String(label)} className="nexlo-card p-4">
              <div className="text-[22px] font-bold text-[#191919]">{value}</div>
              <div className="text-[12px] text-[#707070]">{label}</div>
            </div>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {["all", "active", "draft", "sold", "ended"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`h-9 rounded-full px-4 text-[13px] font-semibold ${
                filter === tab ? "bg-[#0f1c3f] text-white" : "border border-[#e7e7e7] text-[#191919] hover:bg-[#f7f7f7]"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-[14px] text-[#707070]">Loading…</div>
        ) : listings.length === 0 ? (
          <div className="nexlo-card p-12 text-center">
            <p className="text-[14px] text-[#707070]">No listings in this view.</p>
            <Link href="/sell/create" className="nexlo-btn mt-4">
              Create your first listing
            </Link>
          </div>
        ) : (
          <div className="nexlo-card overflow-hidden">
            <table className="min-w-full divide-y divide-[#e7e7e7] text-left">
              <thead className="bg-[#f7f7f7]">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-[#707070]">
                  <th className="px-5 py-3">Listing</th>
                  <th className="px-5 py-3">Format</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Views / watches</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7e7e7]">
                {listings.map((listing) => (
                  <tr key={listing.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {listing.primary_photo ? (
                          <img src={listing.primary_photo} alt={listing.title} className="h-14 w-14 rounded-xl border border-[#e7e7e7] object-cover" />
                        ) : null}
                        <div>
                          <Link href={`/listing/${listing.id}`} className="text-[14px] font-semibold text-[#191919] hover:text-[#3665f3]">
                            {listing.title}
                          </Link>
                          <div className="text-[12px] text-[#707070]">{listing.category_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[13px] text-[#707070]">
                      {listing.format === "fixed" && "Buy It Now"}
                      {listing.format === "auction" && "Auction"}
                      {listing.format === "both" && "Auction + BIN"}
                    </td>
                    <td className="px-5 py-4 text-[13px] text-[#191919]">
                      {listing.format === "auction" && listing.auction_current_price
                        ? formatPrice(listing.auction_current_price)
                        : formatPrice(listing.price)}
                      {listing.format === "auction" ? (
                        <div className="text-[11px] text-[#707070]">{listing.auction_bid_count} bids</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(listing.status)}</td>
                    <td className="px-5 py-4 text-[13px] text-[#707070]">
                      {listing.view_count} / {listing.watch_count}
                    </td>
                    <td className="px-5 py-4 text-right text-[13px]">
                      <div className="flex justify-end gap-3">
                        {listing.status === "draft" ? (
                          <button onClick={() => handlePublishListing(listing.id)} className="nexlo-link">
                            Publish
                          </button>
                        ) : null}
                        {listing.status === "active" ? (
                          <button onClick={() => handleEndListing(listing.id)} className="text-[#8a6d1f]">
                            End
                          </button>
                        ) : null}
                        <Link href={`/sell/edit/${listing.id}`} className="nexlo-link">
                          Edit
                        </Link>
                        <button onClick={() => handleDeleteListing(listing.id)} className="text-[#e53238]">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

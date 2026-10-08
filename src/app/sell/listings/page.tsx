"use client";

import { useState, useEffect } from "react";
import { accountApi, apiBase } from "@/lib/account-api";
import Link from "next/link";

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

      const res = await fetch(
        `${apiBase}/api/v1/listings/seller/listings?status=${filter}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

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
      active: "bg-green-100 text-green-800",
      draft: "bg-gray-100 text-gray-800",
      sold: "bg-blue-100 text-blue-800",
      ended: "bg-yellow-100 text-yellow-800",
      removed: "bg-red-100 text-red-800",
    };

    return (
      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${colors[status] || "bg-gray-100"}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Listings</h1>
            <p className="mt-2 text-gray-600">Manage your active, draft, and sold listings</p>
          </div>
          <Link
            href="/sell/create"
            className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
          >
            + Create Listing
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-5">
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="text-2xl font-bold text-gray-900">{stats.active_count}</div>
            <div className="text-sm text-gray-500">Active</div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="text-2xl font-bold text-gray-900">{stats.sold_count}</div>
            <div className="text-sm text-gray-500">Sold</div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="text-2xl font-bold text-gray-900">{stats.draft_count}</div>
            <div className="text-sm text-gray-500">Drafts</div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="text-2xl font-bold text-gray-900">{stats.total_views?.toLocaleString() || 0}</div>
            <div className="text-sm text-gray-500">Total Views</div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="text-2xl font-bold text-gray-900">{stats.total_watches?.toLocaleString() || 0}</div>
            <div className="text-sm text-gray-500">Total Watches</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex gap-8">
            {["all", "active", "draft", "sold", "ended"].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`border-b-2 px-1 py-4 text-sm font-medium ${
                  filter === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Listings */}
        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading...</div>
        ) : listings.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <p className="text-gray-500">No listings found.</p>
            <Link
              href="/sell/create"
              className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
            >
              Create Your First Listing
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Listing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Format
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Views / Watches
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {listings.map((listing) => (
                  <tr key={listing.id}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        {listing.primary_photo && (
                          <img
                            src={listing.primary_photo}
                            alt={listing.title}
                            className="h-16 w-16 rounded object-cover"
                          />
                        )}
                        <div>
                          <Link
                            href={`/listing/${listing.id}`}
                            className="font-medium text-gray-900 hover:text-blue-600"
                          >
                            {listing.title}
                          </Link>
                          <div className="text-sm text-gray-500">{listing.category_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {listing.format === "fixed" && "Fixed Price"}
                      {listing.format === "auction" && "Auction"}
                      {listing.format === "both" && "Auction + BIN"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {listing.format === "auction" && listing.auction_current_price
                        ? formatPrice(listing.auction_current_price)
                        : formatPrice(listing.price)}
                      {listing.format === "auction" && (
                        <div className="text-xs text-gray-500">{listing.auction_bid_count} bids</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">{getStatusBadge(listing.status)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {listing.view_count} / {listing.watch_count}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        {listing.status === "draft" && (
                          <button
                            onClick={() => handlePublishListing(listing.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Publish
                          </button>
                        )}
                        {listing.status === "active" && (
                          <button
                            onClick={() => handleEndListing(listing.id)}
                            className="text-yellow-600 hover:text-yellow-900"
                          >
                            End
                          </button>
                        )}
                        <Link href={`/sell/edit/${listing.id}`} className="text-blue-600 hover:text-blue-900">
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDeleteListing(listing.id)}
                          className="text-red-600 hover:text-red-900"
                        >
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
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiBase } from "@/lib/account-api";

interface Listing {
  id: number;
  title: string;
  subtitle: string | null;
  format: string;
  price: number | null;
  quantity: number;
  auction_current_price: number | null;
  auction_bid_count: number;
  auction_ends_at: string | null;
  shipping_free: boolean;
  shipping_cost: number | null;
  watch_count: number;
  category_name: string;
  category_slug: string;
  brand_name: string | null;
  primary_photo: string | null;
  seller_username: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface Brand {
  id: number;
  name: string;
  slug: string;
}

interface Condition {
  id: number;
  name: string;
  slug: string;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams?.get("q") || "";
  const categoryParam = searchParams?.get("category") || "";

  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    category_id: "",
    brand_id: "",
    condition: "",
    format: "",
    min_price: "",
    max_price: "",
    sort: "newest",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const limit = 24;

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    if (query || filters.category_id) {
      searchListings();
    } else {
      browseListings();
    }
  }, [query, filters, currentPage]);

  async function loadFilterOptions() {
    try {
      const [catRes, brandRes, condRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/catalog/categories?level=1`),
        fetch(`${apiBase}/api/v1/catalog/brands?limit=100`),
        fetch(`${apiBase}/api/v1/catalog/conditions`),
      ]);

      const [catData, brandData, condData] = await Promise.all([
        catRes.json(),
        brandRes.json(),
        condRes.json(),
      ]);

      setCategories(catData.categories || []);
      setBrands(brandData.brands || []);
      setConditions(condData.conditions || []);
    } catch (err) {
      console.error("Failed to load filter options:", err);
    }
  }

  async function searchListings() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(limit),
        offset: String((currentPage - 1) * limit),
      });

      if (filters.category_id) params.set("category_id", filters.category_id);

      const res = await fetch(`${apiBase}/api/v1/listings/search?${params}`);
      if (!res.ok) throw new Error("Search failed");

      const data = await res.json();
      setListings(data.listings || []);
      setTotal(data.listings?.length || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function browseListings() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String((currentPage - 1) * limit),
        sort: filters.sort,
      });

      if (filters.category_id) params.set("category_id", filters.category_id);
      if (filters.brand_id) params.set("brand_id", filters.brand_id);
      if (filters.condition) params.set("condition", filters.condition);
      if (filters.format) params.set("format", filters.format);
      if (filters.min_price) params.set("min_price", filters.min_price);
      if (filters.max_price) params.set("max_price", filters.max_price);

      const res = await fetch(`${apiBase}/api/v1/listings?${params}`);
      if (!res.ok) throw new Error("Failed to load listings");

      const data = await res.json();
      setListings(data.listings || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }

  function clearFilters() {
    setFilters({
      category_id: "",
      brand_id: "",
      condition: "",
      format: "",
      min_price: "",
      max_price: "",
      sort: "newest",
    });
    setCurrentPage(1);
  }

  function formatPrice(price: number | null) {
    if (price === null) return "N/A";
    return `NPR ${price.toLocaleString()}`;
  }

  function formatTimeRemaining(endsAt: string | null) {
    if (!endsAt) return null;
    const now = new Date();
    const end = new Date(endsAt);
    const diff = end.getTime() - now.getTime();
    if (diff < 0) return "Ended";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    return `${hours}h`;
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {query ? `Search results for "${query}"` : "Browse Listings"}
          </h1>
          {total > 0 && <p className="mt-2 text-gray-600">{total.toLocaleString()} items found</p>}
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="flex gap-6">
          {/* Filters Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="sticky top-4 rounded-lg bg-white p-4 shadow">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-700">
                  Clear
                </button>
              </div>

              <div className="space-y-4">
                {/* Category */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Category</label>
                  <select
                    value={filters.category_id}
                    onChange={(e) => updateFilter("category_id", e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Format */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Format</label>
                  <select
                    value={filters.format}
                    onChange={(e) => updateFilter("format", e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">All Formats</option>
                    <option value="fixed">Buy It Now</option>
                    <option value="auction">Auction</option>
                  </select>
                </div>

                {/* Brand */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Brand</label>
                  <select
                    value={filters.brand_id}
                    onChange={(e) => updateFilter("brand_id", e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">All Brands</option>
                    {brands.slice(0, 50).map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Condition */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Condition</label>
                  <select
                    value={filters.condition}
                    onChange={(e) => updateFilter("condition", e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Any Condition</option>
                    {conditions.map((cond) => (
                      <option key={cond.id} value={cond.id}>
                        {cond.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price Range */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Price Range (NPR)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.min_price}
                      onChange={(e) => updateFilter("min_price", e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.max_price}
                      onChange={(e) => updateFilter("max_price", e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Listings Grid */}
          <div className="flex-1">
            {/* Sort */}
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {loading ? "Loading..." : `Showing ${listings.length} of ${total.toLocaleString()} results`}
              </div>
              <select
                value={filters.sort}
                onChange={(e) => updateFilter("sort", e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="newest">Newest First</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="ending_soon">Ending Soon</option>
                <option value="popular">Most Popular</option>
              </select>
            </div>

            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading...</div>
            ) : listings.length === 0 ? (
              <div className="rounded-lg bg-white p-12 text-center shadow">
                <p className="text-gray-500">No listings found. Try adjusting your filters.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {listings.map((listing) => (
                    <Link
                      key={listing.id}
                      href={`/listing/${listing.id}`}
                      className="group overflow-hidden rounded-lg bg-white shadow transition hover:shadow-lg"
                    >
                      <div className="relative aspect-square overflow-hidden bg-gray-100">
                        {listing.primary_photo ? (
                          <img
                            src={listing.primary_photo}
                            alt={listing.title}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-gray-400">
                            No Image
                          </div>
                        )}
                        {listing.shipping_free && (
                          <div className="absolute top-2 left-2 rounded bg-green-500 px-2 py-1 text-xs font-semibold text-white">
                            Free Shipping
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-blue-600">
                          {listing.title}
                        </h3>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-lg font-bold text-gray-900">
                            {listing.format === "auction" && listing.auction_current_price
                              ? formatPrice(listing.auction_current_price)
                              : formatPrice(listing.price)}
                          </span>
                          {listing.format === "auction" && (
                            <span className="text-xs text-gray-500">{listing.auction_bid_count} bids</span>
                          )}
                        </div>
                        {listing.auction_ends_at && (
                          <div className="mt-1 text-xs text-red-600">
                            {formatTimeRemaining(listing.auction_ends_at)} left
                          </div>
                        )}
                        <div className="mt-2 text-xs text-gray-500">{listing.category_name}</div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="flex items-center px-4 text-sm text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center">Loading...</div>}>
      <SearchContent />
    </Suspense>
  );
}

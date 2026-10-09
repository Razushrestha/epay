"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { accountApi, apiBase, getToken } from "@/lib/account-api";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";
import { SaveButton } from "@/components/commerce/SaveButton";
import { addToCart } from "@/lib/commerce";

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
    sort: "best_match",
    location: "",
    free_shipping: "",
    seller_rating: "",
    exclude: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const limit = 24;

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      category_id: /^\d+$/.test(searchParams?.get("category_id") || "")
        ? searchParams?.get("category_id") || ""
        : /^\d+$/.test(searchParams?.get("category") || "")
          ? searchParams?.get("category") || ""
          : current.category_id,
      brand_id: searchParams?.get("brand_id") || current.brand_id,
      condition: searchParams?.get("condition") || current.condition,
      format: searchParams?.get("format") || current.format,
      min_price: searchParams?.get("min_price") || current.min_price,
      max_price: searchParams?.get("max_price") || current.max_price,
      sort: searchParams?.get("sort") || current.sort,
      location: searchParams?.get("location") || current.location,
      free_shipping: searchParams?.get("free_shipping") || current.free_shipping,
      seller_rating: searchParams?.get("seller_rating") || current.seller_rating,
      exclude: searchParams?.get("exclude") || current.exclude,
    }));
  }, [searchParams]);

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
      if (filters.brand_id) params.set("brand_id", filters.brand_id);
      if (filters.condition) params.set("condition", filters.condition);
      if (filters.format) params.set("format", filters.format);
      if (filters.min_price) params.set("min_price", filters.min_price);
      if (filters.max_price) params.set("max_price", filters.max_price);
      if (filters.location) params.set("location", filters.location);
      if (filters.free_shipping) params.set("free_shipping", filters.free_shipping);
      if (filters.seller_rating) params.set("seller_rating", filters.seller_rating);
      if (filters.exclude) params.set("exclude", filters.exclude);
      params.set("sort", filters.sort);

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
      if (filters.location) params.set("location", filters.location);
      if (filters.free_shipping) params.set("free_shipping", filters.free_shipping);
      if (filters.seller_rating) params.set("seller_rating", filters.seller_rating);

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
      sort: "best_match",
      location: "",
      free_shipping: "",
      seller_rating: "",
      exclude: "",
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
    <div className="min-h-screen bg-white">
      <PageHero
        eyebrow="Search"
        title={query ? `Results for “${query}”` : "Browse listings"}
        body={total > 0 ? `${total.toLocaleString()} items · Save with the heart or add to cart from here.` : "Filter by category, format, and price. Escrow covers every purchase."}
        cta="Advanced search"
        href="/search/advanced"
      />
      <div className="page-shell py-8">
        <div className="mb-6">
          {total > 0 && <p className="text-[14px] text-[#707070]">{total.toLocaleString()} items</p>}
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-[#f5c2c7] bg-[#fff5f5] p-4 text-[14px] text-[#e53238]">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Filters Sidebar */}
          <div className="w-full shrink-0 lg:w-64">
            <div className="nexlo-card sticky top-4 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-[#191919]">Filters</h2>
                <button onClick={clearFilters} className="nexlo-link text-[13px]">
                  Clear
                </button>
              </div>

              <div className="space-y-4">
                {/* Category */}
                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-[#191919]">Category</label>
                  <select
                    value={filters.category_id}
                    onChange={(e) => updateFilter("category_id", e.target.value)}
                    className="w-full rounded-xl border border-[#e7e7e7] px-3 py-2 text-[13px]"
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
                  <label className="mb-2 block text-[13px] font-semibold text-[#191919]">Format</label>
                  <select
                    value={filters.format}
                    onChange={(e) => updateFilter("format", e.target.value)}
                    className="w-full rounded-xl border border-[#e7e7e7] px-3 py-2 text-[13px]"
                  >
                    <option value="">All Formats</option>
                    <option value="fixed">Buy It Now</option>
                    <option value="auction">Auction</option>
                  </select>
                </div>

                {/* Brand */}
                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-[#191919]">Brand</label>
                  <select
                    value={filters.brand_id}
                    onChange={(e) => updateFilter("brand_id", e.target.value)}
                    className="w-full rounded-xl border border-[#e7e7e7] px-3 py-2 text-[13px]"
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
                  <label className="mb-2 block text-[13px] font-semibold text-[#191919]">Condition</label>
                  <select
                    value={filters.condition}
                    onChange={(e) => updateFilter("condition", e.target.value)}
                    className="w-full rounded-xl border border-[#e7e7e7] px-3 py-2 text-[13px]"
                  >
                    <option value="">Any Condition</option>
                    {conditions.map((cond) => (
                      <option key={cond.id} value={cond.id}>
                        {cond.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-[#191919]">Location</label>
                  <input
                    type="text"
                    placeholder="Kathmandu"
                    value={filters.location}
                    onChange={(e) => updateFilter("location", e.target.value)}
                    className="w-full rounded-xl border border-[#e7e7e7] px-3 py-2 text-[13px]"
                  />
                </div>
                <label className="flex items-center gap-2 text-[13px] text-[#191919]">
                  <input
                    type="checkbox"
                    checked={filters.free_shipping === "1"}
                    onChange={(e) => updateFilter("free_shipping", e.target.checked ? "1" : "")}
                  />
                  Free shipping
                </label>
                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-[#191919]">Min seller rating</label>
                  <select
                    value={filters.seller_rating}
                    onChange={(e) => updateFilter("seller_rating", e.target.value)}
                    className="w-full rounded-xl border border-[#e7e7e7] px-3 py-2 text-[13px]"
                  >
                    <option value="">Any</option>
                    <option value="80">80%+</option>
                    <option value="90">90%+</option>
                    <option value="98">98%+</option>
                  </select>
                </div>
                {/* Price Range */}
                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-[#191919]">Price (NPR)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.min_price}
                      onChange={(e) => updateFilter("min_price", e.target.value)}
                      className="w-full rounded-xl border border-[#e7e7e7] px-3 py-2 text-[13px]"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.max_price}
                      onChange={(e) => updateFilter("max_price", e.target.value)}
                      className="w-full rounded-xl border border-[#e7e7e7] px-3 py-2 text-[13px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Listings Grid */}
          <div className="flex-1">
            {/* Sort */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] text-[#707070]">
                {loading ? "Loading…" : `${listings.length} of ${total.toLocaleString()} results`}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 rounded-full border border-[#e7e7e7] px-3 text-[13px] text-[#3665f3]"
                  onClick={async () => {
                    if (!getToken()) {
                      window.location.href = `/login?redirect=/search?q=${encodeURIComponent(query)}`;
                      return;
                    }
                    await accountApi("/api/v1/listings/saved-searches", {
                      method: "POST",
                      body: JSON.stringify({
                        name: query || "Saved search",
                        query_params: { q: query, ...filters },
                        notify_new_listings: true,
                      }),
                    });
                    setSaveNotice("Search saved. We will email you when new items match.");
                  }}
                >
                  Save this search
                </button>
                <Link href="/search/advanced" className="h-9 rounded-full px-3 text-[13px] leading-9 text-[#3665f3] hover:underline">
                  Advanced
                </Link>
                {saveNotice ? <span className="text-[12px] text-[#12a37e]">{saveNotice}</span> : null}
              <select
                value={filters.sort}
                onChange={(e) => updateFilter("sort", e.target.value)}
                className="h-9 rounded-full border border-[#e7e7e7] px-3 text-[13px]"
              >
                <option value="best_match">Best Match</option>
                <option value="newest">Newest First</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="ending_soon">Ending Soon</option>
                <option value="popular">Most Popular</option>
              </select>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-[14px] text-[#707070]">Loading…</div>
            ) : listings.length === 0 ? (
              <div className="nexlo-card p-12 text-center">
                <p className="text-[14px] text-[#707070]">No listings found. Try adjusting your filters.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {listings.map((listing) => (
                    <article
                      key={listing.id}
                      className="nexlo-card group relative overflow-hidden transition hover:shadow-[0_8px_24px_-16px_rgba(15,28,63,0.35)]"
                    >
                      <Link href={`/listing/${listing.id}`} className="block">
                        <div className="relative aspect-square overflow-hidden bg-[#f7f7f7]">
                          {listing.primary_photo ? (
                            <img
                              src={listing.primary_photo}
                              alt={listing.title}
                              className="h-full w-full object-cover transition group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[12px] text-[#707070]">
                              No image
                            </div>
                          )}
                          {listing.shipping_free && (
                            <div className="absolute top-2 left-2 rounded-full bg-[#0d9488] px-2 py-1 text-[11px] font-semibold text-white">
                              Free shipping
                            </div>
                          )}
                        </div>
                        <div className="p-3 pb-12">
                          <h3 className="line-clamp-2 text-[13px] font-medium text-[#191919] group-hover:text-[#3665f3]">
                            {listing.title}
                          </h3>
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-[16px] font-bold text-[#191919]">
                              {listing.format === "auction" && listing.auction_current_price
                                ? formatPrice(listing.auction_current_price)
                                : formatPrice(listing.price)}
                            </span>
                            {listing.format === "auction" && (
                              <span className="text-[11px] text-[#707070]">{listing.auction_bid_count} bids</span>
                            )}
                          </div>
                          {listing.auction_ends_at && (
                            <div className="mt-1 text-[11px] text-[#e53238]">
                              {formatTimeRemaining(listing.auction_ends_at)} left
                            </div>
                          )}
                          <div className="mt-2 text-[11px] text-[#707070]">{listing.category_name}</div>
                        </div>
                      </Link>
                      <SaveButton
                        listingId={listing.id}
                        title={listing.title}
                        photo={listing.primary_photo}
                        price={listing.auction_current_price || listing.price || 0}
                        className="absolute right-2 top-2 z-10"
                      />
                      {listing.format !== "auction" ? (
                        <button
                          type="button"
                          className="absolute bottom-3 left-3 right-3 h-8 rounded-full bg-[#0f1c3f] text-[12px] font-semibold text-white"
                          onClick={async (event) => {
                            event.preventDefault();
                            await addToCart({
                              listingId: listing.id,
                              title: listing.title,
                              photo: listing.primary_photo,
                              price: listing.price || 0,
                              seller: listing.seller_username,
                            });
                          }}
                        >
                          Add to cart
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-9 rounded-full border border-[#e7e7e7] px-4 text-[13px] disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="flex items-center px-4 text-[13px] text-[#707070]">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-9 rounded-full border border-[#e7e7e7] px-4 text-[13px] disabled:opacity-50"
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
      <SiteFooter />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-[14px] text-[#707070]">Loading…</div>}>
      <SearchContent />
    </Suspense>
  );
}

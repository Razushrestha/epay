"use client";

import { useState, useEffect, Suspense, useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { accountApi, apiBase, getToken } from "@/lib/account-api";
import { SiteFooter } from "@/components/SiteFooter";
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
  status?: string;
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
    completed: "",
  });
  const [specFilters, setSpecFilters] = useState<Record<string, string>>({});
  const [facets, setFacets] = useState<Record<string, { value: string; count: number }[]>>({});

  const [currentPage, setCurrentPage] = useState(1);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const chipBarRef = useRef<HTMLDivElement>(null);
  const limit = 24;

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!chipBarRef.current?.contains(event.target as Node)) setMenu(null);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
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
      completed: searchParams?.get("completed") || current.completed,
    }));
  }, [searchParams]);

  useEffect(() => {
    if (query || filters.category_id) {
      searchListings();
    } else {
      browseListings();
    }
  }, [query, filters, currentPage, specFilters]);

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
      if (filters.completed) params.set("completed", filters.completed);
      if (Object.keys(specFilters).length) params.set("specifics", JSON.stringify(specFilters));
      params.set("sort", filters.sort);

      const res = await fetch(`${apiBase}/api/v1/listings/search?${params}`);
      if (!res.ok) throw new Error("Search failed");

      const data = await res.json();
      setListings(data.listings || []);
      setFacets(data.facets || {});
      setTotal(Number(data.total || data.listings?.length || 0));
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
      if (filters.completed) params.set("completed", filters.completed);
      if (Object.keys(specFilters).length) params.set("specifics", JSON.stringify(specFilters));

      const res = await fetch(`${apiBase}/api/v1/listings?${params}`);
      if (!res.ok) throw new Error("Failed to load listings");

      const data = await res.json();
      setListings(data.listings || []);
      setFacets(data.facets || {});
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
      completed: "",
    });
    setSpecFilters({});
    setCurrentPage(1);
  }

  function formatPrice(price: number | string | null) {
    if (price === null || price === "") return "N/A";
    return `NPR ${Number(price).toLocaleString("en-NP")}`;
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
  const categoryLabel = categories.find((cat) => String(cat.id) === filters.category_id)?.name;
  const brandLabel = brands.find((brand) => String(brand.id) === filters.brand_id)?.name;
  const conditionLabel = conditions.find((cond) => String(cond.id) === filters.condition)?.name;
  const formatLabel = filters.format === "auction" ? "Auction" : filters.format === "fixed" ? "Buy It Now" : "";
  const priceLabel =
    filters.min_price || filters.max_price
      ? `${filters.min_price || "0"}–${filters.max_price || "∞"}`
      : "";
  const hasFilters = Boolean(
    filters.category_id ||
      filters.brand_id ||
      filters.condition ||
      filters.format ||
      filters.min_price ||
      filters.max_price ||
      filters.location ||
      filters.free_shipping ||
      filters.seller_rating ||
      filters.completed ||
      Object.keys(specFilters).length,
  );
  const sortLabel =
    {
      best_match: "Best Match",
      newest: "Newest",
      price_low: "Price: low",
      price_high: "Price: high",
      ending_soon: "Ending soon",
      popular: "Most popular",
    }[filters.sort] || "Best Match";

  const chips: { id: string; label: string; active: boolean }[] = [
    { id: "category", label: categoryLabel || "Category", active: Boolean(filters.category_id) },
    { id: "format", label: formatLabel || "Buying format", active: Boolean(filters.format) },
    { id: "brand", label: brandLabel || "Brand", active: Boolean(filters.brand_id) },
    { id: "condition", label: conditionLabel || "Condition", active: Boolean(filters.condition) },
    { id: "price", label: priceLabel || "Price", active: Boolean(priceLabel) },
    { id: "location", label: filters.location || "Location", active: Boolean(filters.location) },
  ];

  function pick(id: string, value: string, key?: string) {
    if (key) updateFilter(key, value);
    setMenu(null);
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className="page-shell py-5">
        <p className="text-[12.5px] text-[#98a2b3]">
          <Link href="/" className="hover:underline">Home</Link>
          <span className="mx-1.5">›</span>
          <span className="text-[#667085]">{query ? "Search" : "All listings"}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-[#0f1c3f] sm:text-[30px]">
              {query ? `Results for “${query}”` : "Browse listings"}
            </h1>
            <p className="mt-1 text-[13px] text-[#6b7587]">
              {loading ? "Loading…" : `${total.toLocaleString()} ${total === 1 ? "item" : "items"} · Escrow on every purchase.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              className="text-[13px] font-semibold text-[#3665f3] hover:underline"
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
                setSaveNotice("Search saved.");
              }}
            >
              Save search
            </button>
            <Link href="/search/advanced" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
              Advanced search →
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-[#f5c2c7] bg-[#fff5f5] p-4 text-[14px] text-[#e53238]">{error}</div>
        ) : null}

        <div ref={chipBarRef} className="relative z-30 mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 py-0.5">
            {chips.map((chip) => (
              <div key={chip.id} className="relative shrink-0">
                <ChipButton active={chip.active || menu === chip.id} onClick={() => setMenu(menu === chip.id ? null : chip.id)}>
                  {chip.label}
                </ChipButton>
                {menu === chip.id ? (
                  <div className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-[220px] rounded-2xl border border-[#e7eef6] bg-white p-1.5 shadow-[0_12px_32px_-16px_rgba(15,28,63,0.35)]">
                    {chip.id === "category" ? (
                      [{ id: "", name: "All categories" }, ...categories].map((cat) => (
                        <MenuItem
                          key={cat.id || "all"}
                          active={String(cat.id || "") === filters.category_id}
                          onClick={() => pick("category", String(cat.id || ""), "category_id")}
                        >
                          {cat.name}
                        </MenuItem>
                      ))
                    ) : null}
                    {chip.id === "format"
                      ? [
                          { id: "", name: "Any format" },
                          { id: "fixed", name: "Buy It Now" },
                          { id: "auction", name: "Auction" },
                        ].map((row) => (
                          <MenuItem key={row.id || "all"} active={filters.format === row.id} onClick={() => pick("format", row.id, "format")}>
                            {row.name}
                          </MenuItem>
                        ))
                      : null}
                    {chip.id === "brand"
                      ? [{ id: "", name: "All brands" }, ...brands.slice(0, 40)].map((brand) => (
                          <MenuItem
                            key={brand.id || "all"}
                            active={String(brand.id || "") === filters.brand_id}
                            onClick={() => pick("brand", String(brand.id || ""), "brand_id")}
                          >
                            {brand.name}
                          </MenuItem>
                        ))
                      : null}
                    {chip.id === "condition"
                      ? [{ id: "", name: "Any condition" }, ...conditions].map((cond) => (
                          <MenuItem
                            key={cond.id || "all"}
                            active={String(cond.id || "") === filters.condition}
                            onClick={() => pick("condition", String(cond.id || ""), "condition")}
                          >
                            {cond.name}
                          </MenuItem>
                        ))
                      : null}
                    {chip.id === "price" ? (
                      <div className="space-y-2 p-2">
                        {[
                          { min: "", max: "", name: "Any price" },
                          { min: "", max: "5000", name: "Under NPR 5,000" },
                          { min: "5000", max: "20000", name: "NPR 5,000 to 20,000" },
                          { min: "20000", max: "50000", name: "NPR 20,000 to 50,000" },
                          { min: "50000", max: "", name: "Over NPR 50,000" },
                        ].map((band) => (
                          <MenuItem
                            key={band.name}
                            active={filters.min_price === band.min && filters.max_price === band.max}
                            onClick={() => {
                              setFilters((prev) => ({ ...prev, min_price: band.min, max_price: band.max }));
                              setCurrentPage(1);
                              setMenu(null);
                            }}
                          >
                            {band.name}
                          </MenuItem>
                        ))}
                        <div className="flex gap-2 px-1 pt-1">
                          <input
                            type="number"
                            placeholder="Min"
                            value={filters.min_price}
                            onChange={(e) => updateFilter("min_price", e.target.value)}
                            className="nexlo-field h-9 flex-1 rounded-xl"
                          />
                          <input
                            type="number"
                            placeholder="Max"
                            value={filters.max_price}
                            onChange={(e) => updateFilter("max_price", e.target.value)}
                            className="nexlo-field h-9 flex-1 rounded-xl"
                          />
                        </div>
                      </div>
                    ) : null}
                    {chip.id === "location" ? (
                      <div className="p-2">
                        <input
                          type="text"
                          placeholder="Kathmandu"
                          value={filters.location}
                          onChange={(e) => updateFilter("location", e.target.value)}
                          className="nexlo-field h-10"
                        />
                        {["Kathmandu", "Pokhara", "Lalitpur", "Bhaktapur"].map((city) => (
                          <MenuItem key={city} active={filters.location === city} onClick={() => pick("location", city, "location")}>
                            {city}
                          </MenuItem>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMenu(menu === "all" ? null : "all")}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-medium leading-none ${
                  menu === "all" ? "border-[#3665f3] bg-[#eef3ff] text-[#3665f3]" : "border-[#e7eef6] bg-white text-[#0f1c3f] hover:border-[#c9d8ff]"
                }`}
              >
                All filters
              </button>
              {menu === "all" ? (
                <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-[280px] rounded-2xl border border-[#e7eef6] bg-white p-4 shadow-[0_12px_32px_-16px_rgba(15,28,63,0.35)]">
                  <label className="flex items-center gap-2 text-[13px] text-[#0f1c3f]">
                    <input type="checkbox" checked={filters.free_shipping === "1"} onChange={(e) => updateFilter("free_shipping", e.target.checked ? "1" : "")} />
                    Free shipping
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-[13px] text-[#0f1c3f]">
                    <input type="checkbox" checked={filters.completed === "1"} onChange={(e) => updateFilter("completed", e.target.checked ? "1" : "")} />
                    Sold / completed
                  </label>
                  <p className="mt-3 text-[12px] font-bold text-[#0f1c3f]">Min seller rating</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["", "80", "90", "98"].map((rating) => (
                      <button
                        key={rating || "any"}
                        type="button"
                        onClick={() => updateFilter("seller_rating", rating)}
                        className={`rounded-full px-3 py-1.5 text-[12px] ${filters.seller_rating === rating ? "bg-[#3665f3] text-white" : "bg-[#f4f8fd] text-[#0f1c3f]"}`}
                      >
                        {rating ? `${rating}%+` : "Any"}
                      </button>
                    ))}
                  </div>
                  {Object.entries(facets).map(([name, options]) => (
                    <div key={name} className="mt-3">
                      <p className="text-[12px] font-bold text-[#0f1c3f]">{name}</p>
                      <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                        {options.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setSpecFilters((current) => {
                                const next = { ...current };
                                if (next[name] === opt.value) delete next[name];
                                else next[name] = opt.value;
                                return next;
                              });
                              setCurrentPage(1);
                            }}
                            className={`rounded-full px-3 py-1.5 text-[12px] ${specFilters[name] === opt.value ? "bg-[#3665f3] text-white" : "bg-[#f4f8fd] text-[#0f1c3f]"}`}
                          >
                            {opt.value}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="h-10 shrink-0 px-2 text-[13px] font-semibold text-[#3665f3] hover:underline disabled:invisible"
            >
              Clear
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu(menu === "sort" ? null : "sort")}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#e7eef6] bg-white px-4 text-[13px] font-medium leading-none text-[#0f1c3f] hover:border-[#c9d8ff]"
              >
                <span className="text-[#6b7587]">Sort:</span>
                {sortLabel}
                <Chevron />
              </button>
              {menu === "sort" ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[180px] rounded-2xl border border-[#e7eef6] bg-white p-1.5 shadow-[0_12px_32px_-16px_rgba(15,28,63,0.35)]">
                  {[
                    ["best_match", "Best Match"],
                    ["newest", "Newest"],
                    ["price_low", "Price: low"],
                    ["price_high", "Price: high"],
                    ["ending_soon", "Ending soon"],
                    ["popular", "Most popular"],
                  ].map(([value, label]) => (
                    <MenuItem key={value} active={filters.sort === value} onClick={() => pick("sort", value, "sort")}>
                      {label}
                    </MenuItem>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex h-10 overflow-hidden rounded-full border border-[#e7eef6] bg-white">
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={layout === "grid"}
                onClick={() => setLayout("grid")}
                className={`flex h-10 w-10 items-center justify-center ${layout === "grid" ? "bg-[#eef3ff] text-[#3665f3]" : "text-[#8a94a6]"}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M4 4h6.2v6.2H4V4zm9.8 0H20v6.2h-6.2V4zM4 13.8h6.2V20H4v-6.2zm9.8 0H20V20h-6.2v-6.2z" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="List view"
                aria-pressed={layout === "list"}
                onClick={() => setLayout("list")}
                className={`flex h-10 w-10 items-center justify-center ${layout === "list" ? "bg-[#eef3ff] text-[#3665f3]" : "text-[#8a94a6]"}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M4 6h16v2.2H4V6zm0 5h16v2.2H4V11zm0 5h16v2.2H4V16z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        {saveNotice ? <p className="mt-2 text-[12px] text-[#12a37e]">{saveNotice}</p> : null}

        {loading ? (
          <p className="mt-10 text-center text-[14px] text-[#6b7587]">Loading…</p>
        ) : listings.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-[#ddd] bg-white px-6 py-16 text-center text-[14px] text-[#6b7587]">
            No listings match these filters yet.
          </p>
        ) : (
          <>
            <div className={layout === "grid" ? "mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" : "mt-4 grid gap-3"}>
              {listings.map((listing) => (
                <article
                  key={listing.id}
                  className={
                    layout === "list"
                      ? "nexlo-card group relative flex overflow-hidden hover:border-[#c9d8ff]"
                      : "nexlo-card group relative overflow-hidden hover:border-[#c9d8ff]"
                  }
                >
                  <Link href={`/listing/${listing.id}`} className={layout === "list" ? "flex min-w-0 flex-1" : "block"}>
                    <span className={layout === "list" ? "relative block h-[120px] w-[160px] shrink-0 bg-[#f4f8fd]" : "relative block bg-[#f4f8fd]"}>
                      {listing.primary_photo ? (
                        <img src={listing.primary_photo} alt={listing.title} className={layout === "list" ? "h-full w-full object-cover" : "aspect-[4/3] w-full object-cover"} />
                      ) : (
                        <span className="flex aspect-[4/3] items-center justify-center text-[12px] text-[#6b7587]">No image</span>
                      )}
                      {listing.status === "sold" || listing.status === "ended" ? (
                        <span className="absolute left-2 top-2 rounded-full bg-[#0f1c3f] px-2 py-[3px] text-[10px] font-bold text-white">Sold</span>
                      ) : listing.shipping_free ? (
                        <span className="absolute left-2 top-2 rounded-full bg-[#0d9488] px-2 py-[3px] text-[10px] font-bold text-white">Free shipping</span>
                      ) : null}
                    </span>
                    <span className="block min-w-0 p-3">
                      <span className="clamp-2 block min-h-[36px] text-[13px] font-medium leading-snug text-[#0f1c3f] group-hover:text-[#3665f3]">{listing.title}</span>
                      <span className="mt-1.5 block text-[16px] font-extrabold text-[#0f1c3f]">
                        {listing.format === "auction" && listing.auction_current_price
                          ? formatPrice(listing.auction_current_price)
                          : formatPrice(listing.price)}
                      </span>
                      <span className="mt-1 block text-[11.5px] text-[#6b7587]">
                        {listing.format === "auction"
                          ? `${listing.auction_bid_count} bids${listing.auction_ends_at ? ` · ${formatTimeRemaining(listing.auction_ends_at)} left` : ""}`
                          : "Buy It Now"}
                        {listing.category_name ? ` · ${listing.category_name}` : ""}
                      </span>
                    </span>
                  </Link>
                  <SaveButton
                    listingId={listing.id}
                    title={listing.title}
                    photo={listing.primary_photo}
                    price={listing.auction_current_price || listing.price || 0}
                    className="absolute right-2 top-1.5 z-10"
                  />
                  {listing.format !== "auction" && listing.status !== "sold" && listing.status !== "ended" ? (
                    <button
                      type="button"
                      className="absolute bottom-3 right-3 hidden h-8 rounded-full bg-[#0f1c3f] px-3 text-[12px] font-semibold text-white sm:block"
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
            {totalPages > 1 ? (
              <div className="mt-8 flex justify-center gap-2">
                <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-10 rounded-full border border-[#e7eef6] bg-white px-4 text-[13px] disabled:opacity-50">
                  Previous
                </button>
                <span className="flex items-center px-4 text-[13px] text-[#6b7587]">
                  Page {currentPage} of {totalPages}
                </span>
                <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-10 rounded-full border border-[#e7eef6] bg-white px-4 text-[13px] disabled:opacity-50">
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0 opacity-55" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChipButton({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 max-w-[220px] shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] leading-none transition ${
        active ? "border-[#3665f3] bg-[#eef3ff] font-semibold text-[#3665f3]" : "border-[#e7eef6] bg-white font-medium text-[#0f1c3f] hover:border-[#c9d8ff]"
      }`}
    >
      <span className="truncate">{children}</span>
      <Chevron />
    </button>
  );
}

function MenuItem({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-xl px-3 py-2 text-left text-[13px] hover:bg-[#f4f8fd] ${active ? "font-semibold text-[#3665f3]" : "text-[#0f1c3f]"}`}
    >
      {children}
    </button>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-[14px] text-[#6b7587]">Loading…</div>}>
      <SearchContent />
    </Suspense>
  );
}

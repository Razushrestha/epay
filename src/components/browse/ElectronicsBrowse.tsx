"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  discount,
  npr,
  type ElecProduct,
} from "@/lib/electronics-catalog";
import { loadWatchIds, toggleWatch } from "@/lib/commerce";
import type { CategoryBrowseConfig } from "@/lib/category-catalogs";

const conditions = ["New", "Used", "Refurbished"] as const;
const priceBands = [
  { id: "any", label: "Any price" },
  { id: "under-20", label: "Under NPR 20,000" },
  { id: "20-50", label: "NPR 20,000 – 50,000" },
  { id: "50-100", label: "NPR 50,000 – 100,000" },
  { id: "over-100", label: "Over NPR 100,000" },
] as const;
const citiesFallback = ["Kathmandu", "Pokhara", "Lalitpur"];

type Filters = {
  group: string;
  sub: string;
  brand: string;
  condition: string;
  price: string;
  format: string;
  city: string;
};

const emptyFilters: Filters = {
  group: "",
  sub: "",
  brand: "",
  condition: "",
  price: "any",
  format: "",
  city: "",
};

function matchesPrice(price: number, band: string) {
  if (band === "under-20") return price < 20000;
  if (band === "20-50") return price >= 20000 && price <= 50000;
  if (band === "50-100") return price > 50000 && price <= 100000;
  if (band === "over-100") return price > 100000;
  return true;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[#f5b400]" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 20 20" fill={i < Math.round(rating) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4">
          <path d="m10 1.8 2.4 5.2 5.7.7-4.2 3.9 1.1 5.6L10 14.6 4.9 17.2l1.1-5.6L1.9 7.7l5.7-.7L10 1.8z" />
        </svg>
      ))}
    </span>
  );
}

function GroupIcon({ id }: { id: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6 };
  if (id === "cameras") {
    return (
      <svg {...common}>
        <path d="M4 8h3l2-2h6l2 2h3v11H4V8z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    );
  }
  if (id === "phones") {
    return (
      <svg {...common}>
        <rect x="7" y="2.5" width="10" height="19" rx="2" />
        <path d="M11 18.5h2" />
      </svg>
    );
  }
  if (id === "computers") {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="12" rx="1.5" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    );
  }
  if (id === "appliances") {
    return (
      <svg {...common}>
        <path d="M4 10h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9z" />
        <path d="M8 10V6a4 4 0 0 1 8 0v4" />
      </svg>
    );
  }
  if (id === "smart-home") {
    return (
      <svg {...common}>
        <path d="M4 11 12 4l8 7" />
        <path d="M7 10.5V20h10v-9.5" />
      </svg>
    );
  }
  if (id === "tv-audio") {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M8 20h8" />
      </svg>
    );
  }
  if (id === "vehicle") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </svg>
    );
  }
  if (id === "games") {
    return (
      <svg {...common}>
        <rect x="3" y="7" width="18" height="10" rx="4" />
        <path d="M8 12h3M9.5 10.5v3M16 11h.01M18 13h.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ProductCard({ item, saved, onSave, layout }: { item: ElecProduct; saved: boolean; onSave: () => void; layout: "grid" | "list" }) {
  const off = discount(item);
  return (
    <article className={`group relative rounded-2xl border border-[#eceff3] bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:shadow-md ${layout === "list" ? "flex gap-4" : ""}`}>
      <Link href={item.href} className={layout === "list" ? "block w-[160px] shrink-0" : "block"}>
        <span className="relative block aspect-[5/4] overflow-hidden rounded-xl bg-white">
          <Image src={item.img} alt={item.title} fill className="object-contain p-2" sizes="240px" />
        </span>
      </Link>
      <button
        type="button"
        aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
        onClick={onSave}
        className="absolute right-4 top-4 text-[#b0b6c0] hover:text-[#e11d48]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? "#e11d48" : "none"} stroke="currentColor" strokeWidth="1.7">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
      </button>
      <div className="min-w-0 pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f8ee] px-1.5 py-0.5 text-[11px] font-semibold text-[#159947]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                <path d="m5 12 5 5L20 7" />
              </svg>
              Verified
            </span>
          )}
          <span className="text-[12px] font-semibold text-[#159947]">{item.grade}</span>
        </div>
        <Link href={item.href} className="clamp-2 mt-1.5 block min-h-[36px] text-[13.5px] font-semibold leading-snug text-[#191919] hover:underline">
          {item.title}
        </Link>
        <p className="mt-1.5 flex items-center gap-1 text-[12px] text-[#667085]">
          <Stars rating={item.rating} />
          <span className="font-semibold text-[#191919]">{item.rating.toFixed(1)}</span>
          <span>({item.reviews.toLocaleString()} reviews)</span>
        </p>
        <p className="mt-1 text-[12.5px] font-medium text-[#159947]">{item.shipping}</p>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-[16px] font-bold text-[#191919]">{npr(item.price)}</span>
          {item.was && <span className="text-[12px] text-[#98a0ab] line-through">{npr(item.was)}</span>}
          {off && <span className="text-[12px] font-bold text-[#159947]">{off}% OFF</span>}
        </p>
        <p className="mt-1.5 flex items-center gap-1 text-[12px] text-[#98a0ab]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="3" />
            <path d="M5 19c1.2-3 3.6-4.5 7-4.5S17.8 16 19 19" />
          </svg>
          by {item.seller}
        </p>
      </div>
    </article>
  );
}

export function CategoryBrowse({ config }: { config: CategoryBrowseConfig }) {
  const [openGroup, setOpenGroup] = useState(config.groups[0]?.id ?? "");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [menu, setMenu] = useState<string | null>(null);
  const [sort, setSort] = useState("Best Match");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [saved, setSaved] = useState<number[]>([]);
  const brands = [...new Set(config.products.map((item) => item.brand))];
  const cities = [...new Set(config.products.map((item) => item.city))];

  useEffect(() => {
    loadWatchIds().then((ids) => setSaved([...ids]));
  }, []);

  const visible = useMemo(() => {
    const next = config.products.filter((item) => {
      if (filters.group && item.group !== filters.group) return false;
      if (filters.sub && item.sub !== filters.sub) return false;
      if (filters.brand && item.brand !== filters.brand) return false;
      if (filters.condition && item.condition !== filters.condition) return false;
      if (!matchesPrice(item.price, filters.price)) return false;
      if (filters.format && item.format !== filters.format) return false;
      if (filters.city && item.city !== filters.city) return false;
      return true;
    });
    if (sort === "Price: low") next.sort((a, b) => a.price - b.price);
    else if (sort === "Price: high") next.sort((a, b) => b.price - a.price);
    else if (sort === "Top rated") next.sort((a, b) => b.rating - a.rating);
    return next;
  }, [config.products, filters, sort]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setMenu(null);
  }

  function pickGroup(id: string) {
    setOpenGroup(id);
    setFilters((current) => ({ ...current, group: id, sub: "" }));
  }

  const chips: { id: string; label: string }[] = [
    { id: "group", label: filters.group ? config.groups.find((g) => g.id === filters.group)?.name ?? "Category" : "Category" },
    { id: "brand", label: filters.brand || "Brand" },
    { id: "condition", label: filters.condition || "Condition" },
    { id: "price", label: filters.price === "any" ? "Price" : priceBands.find((b) => b.id === filters.price)?.label ?? "Price" },
    { id: "format", label: filters.format === "auction" ? "Auction" : filters.format === "fixed" ? "Buy It Now" : "Buying format" },
    { id: "city", label: filters.city || "Location" },
  ];

  return (
    <main className="bg-[#f6f7f9]">
      <div className="page-shell grid gap-8 py-5 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="h-fit lg:sticky lg:top-4">
          <p className="px-1 text-[12.5px] text-[#98a2b3]">
            <Link href="/" className="hover:underline">Home</Link>
            <span className="mx-1.5">›</span>
            <span className="text-[#667085]">{config.title}</span>
          </p>
          <ul className="mt-4 space-y-0.5 text-[14px] text-[#243044]">
            {config.groups.map((group) => {
              const open = openGroup === group.id;
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    onClick={() => (open ? setOpenGroup("") : pickGroup(group.id))}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-medium hover:bg-[#f3f6fb] ${open ? "bg-[#eef2fb]" : ""}`}
                  >
                    <span className={open ? "text-[#243044]" : "text-[#8b95a8]"}>
                      <GroupIcon id={group.id} />
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">{group.name}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`shrink-0 text-[#98a2b3] ${open ? "rotate-180" : ""}`}>
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {open && (
                    <ul className="mb-1 ml-[42px] mt-1 space-y-2.5 py-1.5">
                      {group.children.map((child) => (
                        <li key={child}>
                          <button
                            type="button"
                            onClick={() => setFilters((current) => ({ ...current, group: group.id, sub: child }))}
                            className={`text-left text-[13.5px] leading-snug hover:text-[#243044] ${filters.sub === child ? "font-semibold text-[#243044]" : "text-[#7b8494]"}`}
                          >
                            {child}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="min-w-0">
          <h1 className="text-[28px] font-bold tracking-tight text-[#191919]">{config.title}</h1>

          <section className="relative mt-4 h-[200px] overflow-hidden rounded-[18px] border border-[#e6eaf0] bg-white sm:h-[214px]">
            <Image src={config.hero.image} alt="" fill className="object-cover object-[center_58%]" sizes="1100px" priority />
            <div className="absolute inset-0 bg-gradient-to-r from-white from-[8%] via-white/80 via-[24%] to-transparent to-[46%]" />
            <div className="relative z-10 flex h-full max-w-[340px] flex-col justify-center pl-6 pr-4 sm:pl-7">
              <p className="text-[10px] font-bold tracking-[0.16em] text-[#243044]">{config.hero.kicker}</p>
              <h2 className="mt-1.5 text-[26px] font-extrabold leading-[1.05] tracking-tight sm:text-[30px]">
                {config.hero.lines.map((line, index) => (
                  <span key={line} className={index === config.hero.lines.length - 1 ? "block text-[#0f8f86]" : "block text-[#1b2437]"}>
                    {line}
                  </span>
                ))}
              </h2>
              <p className="mt-1.5 max-w-[250px] text-[12.5px] leading-snug text-[#5c6778]">{config.hero.text}</p>
              <button
                type="button"
                onClick={() => setFilters((current) => ({ ...current, condition: config.hero.condition }))}
                className="mt-3 inline-flex w-fit items-center gap-3 rounded-xl bg-[#1c2744] py-1.5 pl-4 pr-1.5 text-[13px] font-semibold text-white hover:bg-[#162038]"
              >
                {config.hero.cta}
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </button>
            </div>
            <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-2xl bg-white px-2.5 py-2 shadow-[0_8px_22px_rgba(16,24,40,0.12)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f8ee] text-[#16a34a]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 3 5 6v6c0 4.2 2.8 7.2 7 9 4.2-1.8 7-4.8 7-9V6l-7-3z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              <span className="pr-1 text-[12px] font-bold leading-[1.15] text-[#16a34a]">
                {config.badge[0]}
                <br />
                {config.badge[1]}
              </span>
            </div>
          </section>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {config.cards.map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, group: card.group, sub: card.sub ?? "" }))}
                className="flex h-[124px] items-stretch overflow-hidden rounded-2xl border border-[#e6eaf0] bg-white text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:shadow-md"
              >
                <span className={`relative w-[44%] shrink-0 ${card.bg}`}>
                  <Image src={card.img} alt="" fill className="object-cover object-center" sizes="220px" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-center px-3.5 py-3">
                  <span className="block text-[15px] font-bold leading-snug text-[#191919]">{card.title}</span>
                  <span className="mt-1 block text-[12.5px] leading-snug text-[#667085]">{card.text}</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[#0f766e]">
                    Shop now <span aria-hidden>→</span>
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="no-scrollbar relative mt-4 flex items-center gap-2 overflow-x-auto">
            {chips.map((chip) => (
              <div key={chip.id} className="relative">
                <button
                  type="button"
                  onClick={() => setMenu(menu === chip.id ? null : chip.id)}
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-[#e7ebf0] bg-white px-3.5 text-[13px] text-[#3d4654] hover:border-[#cfd6e0]"
                >
                  {chip.label}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {menu === chip.id && (
                  <div className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-[180px] rounded-xl border border-[#e7e7e7] bg-white p-1.5 shadow-lg">
                    {chip.id === "group" &&
                      [{ id: "", name: "All categories" }, ...config.groups].map((group) => (
                        <button key={group.id || "all"} type="button" onClick={() => { setFilters((current) => ({ ...current, group: group.id, sub: "" })); setMenu(null); }} className="block w-full rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-[#f4f6f8]">
                          {group.name}
                        </button>
                      ))}
                    {chip.id === "brand" &&
                      ["", ...brands].map((brand) => (
                        <button key={brand || "all"} type="button" onClick={() => setFilter("brand", brand)} className="block w-full rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-[#f4f6f8]">
                          {brand || "All brands"}
                        </button>
                      ))}
                    {chip.id === "condition" &&
                      ["", ...conditions].map((condition) => (
                        <button key={condition || "all"} type="button" onClick={() => setFilter("condition", condition)} className="block w-full rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-[#f4f6f8]">
                          {condition || "Any condition"}
                        </button>
                      ))}
                    {chip.id === "price" &&
                      priceBands.map((band) => (
                        <button key={band.id} type="button" onClick={() => setFilter("price", band.id)} className="block w-full rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-[#f4f6f8]">
                          {band.label}
                        </button>
                      ))}
                    {chip.id === "format" &&
                      [
                        { id: "", label: "Any format" },
                        { id: "fixed", label: "Buy It Now" },
                        { id: "auction", label: "Auction" },
                      ].map((format) => (
                        <button key={format.id || "all"} type="button" onClick={() => setFilter("format", format.id)} className="block w-full rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-[#f4f6f8]">
                          {format.label}
                        </button>
                      ))}
                    {chip.id === "city" &&
                      ["", ...(cities.length ? cities : citiesFallback)].map((city) => (
                        <button key={city || "all"} type="button" onClick={() => setFilter("city", city)} className="block w-full rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-[#f4f6f8]">
                          {city || "Any location"}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setMenu(menu === "all" ? null : "all")}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-[#e7ebf0] bg-white px-3.5 text-[13px] font-medium text-[#3d4654] hover:border-[#cfd6e0]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 6h16M4 12h16M4 18h16" />
                <circle cx="8" cy="6" r="2" fill="white" stroke="currentColor" />
                <circle cx="15" cy="12" r="2" fill="white" stroke="currentColor" />
                <circle cx="10" cy="18" r="2" fill="white" stroke="currentColor" />
              </svg>
              All filters
            </button>
            {menu === "all" && (
              <div className="absolute left-0 top-[42px] z-20 w-[280px] rounded-xl border border-[#e7e7e7] bg-white p-3 shadow-lg">
                <p className="text-[12px] font-bold text-[#191919]">Condition</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {conditions.map((condition) => (
                    <button key={condition} type="button" onClick={() => setFilter("condition", filters.condition === condition ? "" : condition)} className={`rounded-full px-2.5 py-1 text-[12px] ${filters.condition === condition ? "bg-[#243056] text-white" : "bg-[#f4f6f8]"}`}>
                      {condition}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[12px] font-bold text-[#191919]">Buying format</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    { id: "fixed", label: "Buy It Now" },
                    { id: "auction", label: "Auction" },
                  ].map((format) => (
                    <button key={format.id} type="button" onClick={() => setFilter("format", filters.format === format.id ? "" : format.id)} className={`rounded-full px-2.5 py-1 text-[12px] ${filters.format === format.id ? "bg-[#243056] text-white" : "bg-[#f4f6f8]"}`}>
                      {format.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(filters.group || filters.brand || filters.condition || filters.price !== "any" || filters.format || filters.city || filters.sub) && (
              <button type="button" onClick={() => setFilters(emptyFilters)} className="text-[12.5px] font-semibold text-[#3665f3] hover:underline">
                Clear
              </button>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenu(menu === "sort" ? null : "sort")}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-[#e7ebf0] bg-white px-3.5 text-[13px] text-[#3d4654] hover:border-[#cfd6e0]"
                >
                  <span className="text-[#8b939f]">Sort:</span>
                  {sort}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {menu === "sort" && (
                  <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[160px] rounded-xl border border-[#e7e7e7] bg-white p-1.5 shadow-lg">
                    {["Best Match", "Price: low", "Price: high", "Top rated"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => { setSort(option); setMenu(null); }}
                        className={`block w-full rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-[#f4f6f8] ${sort === option ? "font-semibold text-[#3665f3]" : ""}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={layout === "grid"}
                  onClick={() => setLayout("grid")}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${layout === "grid" ? "bg-[#e7efff] text-[#3b6ef5]" : "border border-[#e7ebf0] bg-white text-[#98a2b3]"}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 4h6.2v6.2H4V4zm9.8 0H20v6.2h-6.2V4zM4 13.8h6.2V20H4v-6.2zm9.8 0H20V20h-6.2v-6.2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={layout === "list"}
                  onClick={() => setLayout("list")}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${layout === "list" ? "bg-[#e7efff] text-[#3b6ef5]" : "border border-[#e7ebf0] bg-white text-[#98a2b3]"}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 6h16v2.2H4V6zm0 5h16v2.2H4V11zm0 5h16v2.2H4V16z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <section className="mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-[#191919]">{config.trending}</h2>
              <button type="button" onClick={() => setFilters(emptyFilters)} className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                View all →
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-6">
              {config.products.slice(0, 6).map((item) => (
                <Link key={item.id} href={item.href} className="flex items-center gap-2.5 rounded-xl border border-[#eef1f4] bg-white px-2.5 py-2 hover:shadow-sm">
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden">
                    <Image src={item.img} alt="" fill className="object-contain" sizes="44px" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[#191919]">{item.short ?? item.title.split("–")[0]}</span>
                    <span className="mt-0.5 block text-[11.5px] text-[#8b909a]">From {npr(item.price)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {visible.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-[#ddd] bg-white px-6 py-16 text-center text-[14px] text-[#707070]">
              No listings match these filters yet.
            </p>
          ) : (
            <div className={layout === "grid" ? "mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" : "mt-4 grid gap-3"}>
              {visible.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  layout={layout}
                  saved={saved.includes(item.id)}
                  onSave={async () => {
                    const currently = saved.includes(item.id);
                    setSaved((current) => (currently ? current.filter((id) => id !== item.id) : [...current, item.id]));
                    await toggleWatch({
                      listingId: item.id,
                      saved: currently,
                      title: item.title,
                      photo: item.img,
                      price: item.price,
                      localOnly: true,
                    });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

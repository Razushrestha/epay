"use client";

import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";
import { fetchLevel1Categories, type CatalogNode } from "@/lib/catalog";

export default function AdvancedSearchPage() {
  const [categories, setCategories] = useState<CatalogNode[]>([]);

  useEffect(() => {
    fetchLevel1Categories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <PageHero
        eyebrow="Search"
        title="Advanced search"
        body="Narrow by keywords to exclude, category, buying format, price, location, and seller rating — then open live results."
        cta="Back to search"
        href="/search"
      />
      <form action="/search" method="get" className="page-shell max-w-3xl space-y-5 py-8">
        <div className="nexlo-card space-y-4 p-6">
          <label className="block text-[13px] font-semibold text-[#191919]">
            Keywords
            <input name="q" type="search" placeholder="What are you looking for?" className="mt-1 h-11 w-full rounded-full border border-[#e7e7e7] px-4 text-[14px] font-normal" />
          </label>
          <label className="block text-[13px] font-semibold text-[#191919]">
            Exclude words
            <input name="exclude" type="text" placeholder="Words that must not appear in the title" className="mt-1 h-11 w-full rounded-full border border-[#e7e7e7] px-4 text-[14px] font-normal" />
          </label>
          <label className="block text-[13px] font-semibold text-[#191919]">
            Category
            <select name="category_id" className="mt-1 h-11 w-full rounded-full border border-[#e7e7e7] px-4 text-[14px] font-normal">
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[13px] font-semibold text-[#191919]">
            Buying format
            <select name="format" className="mt-1 h-11 w-full rounded-full border border-[#e7e7e7] px-4 text-[14px] font-normal">
              <option value="">Any</option>
              <option value="fixed">Buy It Now</option>
              <option value="auction">Auction</option>
              <option value="both">Auction or Buy It Now</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[13px] font-semibold text-[#191919]">
              Min price (NPR)
              <input name="min_price" type="number" min="0" className="mt-1 h-11 w-full rounded-full border border-[#e7e7e7] px-4 text-[14px] font-normal" />
            </label>
            <label className="block text-[13px] font-semibold text-[#191919]">
              Max price (NPR)
              <input name="max_price" type="number" min="0" className="mt-1 h-11 w-full rounded-full border border-[#e7e7e7] px-4 text-[14px] font-normal" />
            </label>
          </div>
          <label className="block text-[13px] font-semibold text-[#191919]">
            Item location
            <input name="location" type="text" placeholder="Kathmandu" className="mt-1 h-11 w-full rounded-full border border-[#e7e7e7] px-4 text-[14px] font-normal" />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[#191919]">
            <input type="checkbox" name="free_shipping" value="1" />
            Free shipping
          </label>
          <label className="block text-[13px] font-semibold text-[#191919]">
            Min seller rating
            <select name="seller_rating" className="mt-1 h-11 w-full rounded-full border border-[#e7e7e7] px-4 text-[14px] font-normal">
              <option value="">Any</option>
              <option value="80">80%+</option>
              <option value="90">90%+</option>
              <option value="98">98%+</option>
            </select>
          </label>
          <label className="block text-[13px] font-semibold text-[#191919]">
            Sort
            <select name="sort" className="mt-1 h-11 w-full rounded-full border border-[#e7e7e7] px-4 text-[14px] font-normal">
              <option value="best_match">Best Match</option>
              <option value="newest">Newest</option>
              <option value="price_low">Price: low to high</option>
              <option value="price_high">Price: high to low</option>
              <option value="ending_soon">Ending soon</option>
            </select>
          </label>
        </div>
        <button className="nexlo-btn nexlo-btn-blue h-11 px-8">Search</button>
      </form>
      <SiteFooter />
    </div>
  );
}

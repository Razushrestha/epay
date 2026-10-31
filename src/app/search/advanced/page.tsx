"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { fetchLevel1Categories, type CatalogNode } from "@/lib/catalog";

export default function AdvancedSearchPage() {
  const [categories, setCategories] = useState<CatalogNode[]>([]);

  useEffect(() => {
    fetchLevel1Categories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className="page-shell py-5">
        <p className="text-[12.5px] text-[#98a2b3]">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span className="mx-1.5">›</span>
          <Link href="/search" className="hover:underline">
            Search
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-[#667085]">Advanced</span>
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-[#0f1c3f] sm:text-[30px]">Advanced search</h1>
            <p className="mt-1 max-w-xl text-[13px] text-[#6b7587]">
              Narrow by keywords, category, format, price, and seller rating. Results open on live search with the same chip filters.
            </p>
          </div>
          <Link href="/search" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
            Back to search →
          </Link>
        </div>

        <form action="/search" method="get" className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="nexlo-card space-y-5 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-[13px] font-semibold text-[#0f1c3f]">
                Keywords
                <input name="q" type="search" placeholder="What are you looking for?" className="nexlo-field mt-1.5 h-11 font-normal" />
              </label>
              <label className="block text-[13px] font-semibold text-[#0f1c3f]">
                Exclude words
                <input name="exclude" type="text" placeholder="Words that must not appear" className="nexlo-field mt-1.5 h-11 font-normal" />
              </label>
              <label className="block text-[13px] font-semibold text-[#0f1c3f]">
                Category
                <select name="category_id" className="nexlo-field mt-1.5 h-11 font-normal">
                  <option value="">All categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[13px] font-semibold text-[#0f1c3f]">
                Buying format
                <select name="format" className="nexlo-field mt-1.5 h-11 font-normal">
                  <option value="">Any</option>
                  <option value="fixed">Buy It Now</option>
                  <option value="auction">Auction</option>
                </select>
              </label>
              <label className="block text-[13px] font-semibold text-[#0f1c3f]">
                Min price (NPR)
                <input name="min_price" type="number" min="0" className="nexlo-field mt-1.5 h-11 font-normal" />
              </label>
              <label className="block text-[13px] font-semibold text-[#0f1c3f]">
                Max price (NPR)
                <input name="max_price" type="number" min="0" className="nexlo-field mt-1.5 h-11 font-normal" />
              </label>
              <label className="block text-[13px] font-semibold text-[#0f1c3f]">
                Item location
                <input name="location" type="text" placeholder="Kathmandu" className="nexlo-field mt-1.5 h-11 font-normal" />
              </label>
              <label className="block text-[13px] font-semibold text-[#0f1c3f]">
                Min seller rating
                <select name="seller_rating" className="nexlo-field mt-1.5 h-11 font-normal">
                  <option value="">Any</option>
                  <option value="80">80%+</option>
                  <option value="90">90%+</option>
                  <option value="98">98%+</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-4 border-t border-[#e7eef6] pt-4">
              <label className="flex items-center gap-2 text-[13px] text-[#0f1c3f]">
                <input type="checkbox" name="free_shipping" value="1" />
                Free shipping
              </label>
              <label className="flex items-center gap-2 text-[13px] text-[#0f1c3f]">
                <input type="checkbox" name="completed" value="1" />
                Sold / completed listings
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[13px] font-semibold text-[#0f1c3f]">
                Sort
                <select name="sort" className="nexlo-field h-11 w-[200px] font-normal">
                  <option value="best_match">Best Match</option>
                  <option value="newest">Newest First</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="ending_soon">Ending soon</option>
                </select>
              </label>
              <button type="submit" className="nexlo-btn nexlo-btn-blue h-11 px-8">Search</button>
            </div>
          </div>

          <aside className="nexlo-card h-fit p-5">
            <p className="text-[13px] font-bold text-[#0f1c3f]">Tips</p>
            <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[#6b7587]">
              <li>Use exclude to drop accessories or broken items from results.</li>
              <li>Price is in NPR. Leave min or max blank for an open range.</li>
              <li>Escrow still covers every purchase on the results page.</li>
            </ul>
            <Link href="/search" className="mt-4 inline-flex text-[13px] font-semibold text-[#3665f3] hover:underline">
              Browse all listings
            </Link>
          </aside>
        </form>
      </div>
      <SiteFooter />
    </div>
  );
}

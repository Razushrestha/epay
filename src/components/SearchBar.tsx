"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { apiBase } from "@/lib/account-api";
import { SearchCategoryMenu } from "@/components/SearchCategoryMenu";

type Suggestion = {
  type: "listing" | "category" | string;
  id: number;
  title: string;
  slug?: string;
};

export function SearchBar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`${apiBase}/api/v1/listings/suggest?q=${encodeURIComponent(term)}`);
        const body = (await res.json()) as { suggestions?: Suggestion[] | string[] };
        const raw = body.suggestions || [];
        setItems(
          raw.map((row) =>
            typeof row === "string" ? { type: "listing", id: 0, title: row } : row,
          ),
        );
        setOpen(true);
      } catch {
        setItems([]);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  function goTo(item: Suggestion) {
    setOpen(false);
    if (item.type === "category") {
      router.push(`/search?category_id=${item.id}`);
      return;
    }
    if (item.id) {
      router.push(`/listing/${item.id}`);
      return;
    }
    router.push(`/search?q=${encodeURIComponent(item.title)}`);
  }

  return (
    <div ref={rootRef} className="flex min-w-0 flex-1 items-center gap-2">
      <form action="/search" method="get" className="flex min-w-0 flex-1 items-center gap-2" autoComplete="off">
        <div className="relative flex h-11 min-w-0 flex-1 items-center rounded-full border border-[#d5d5d5] bg-white pl-4 pr-3 focus-within:border-[#3665f3]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#707070" strokeWidth="2.2" className="shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <label htmlFor="site-search" className="sr-only">Search for anything</label>
          <input
            id="site-search"
            name="q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => items.length && setOpen(true)}
            placeholder="Search for anything..."
            className="min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none placeholder:text-[#767676]"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={open && items.length > 0}
          />
          <button
            type="button"
            disabled
            title="Image search is not available yet"
            aria-label="Image search is not available yet"
            className="hidden shrink-0 cursor-not-allowed text-[#c4c4c4] sm:block"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
          <span className="mx-2.5 hidden h-5 w-px bg-[#e0e0e0] md:block" />
          <SearchCategoryMenu />
          {open && items.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-[#e7e7e7] bg-white py-1 shadow-[0_12px_32px_-16px_rgba(15,28,63,0.35)]"
            >
              {items.map((item, index) => (
                <li key={`${item.type}-${item.id}-${index}`}>
                  <button
                    type="button"
                    role="option"
                    className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-[14px] text-[#191919] hover:bg-[#f4f7ff]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => goTo(item)}
                  >
                    <span className="truncate">{item.title}</span>
                    <span className="shrink-0 text-[11px] uppercase tracking-wide text-[#8a94a6]">
                      {item.type === "category" ? "Category" : "Listing"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="submit"
          className="h-11 shrink-0 rounded-full bg-[#3665f3] px-6 text-[15px] font-semibold text-white hover:bg-[#2953c6] sm:px-7"
        >
          Search
        </button>
      </form>
      <Link href="/search/advanced" className="hidden shrink-0 text-[12px] font-medium text-[#3665f3] hover:underline lg:block">
        Advanced
      </Link>
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";

const categories = [
  { value: "all", label: "All Categories" },
  { value: "antiques", label: "Antiques" },
  { value: "art", label: "Art" },
  { value: "baby", label: "Baby" },
  { value: "books", label: "Books" },
  { value: "industrial", label: "Business & Industrial" },
  { value: "cameras", label: "Cameras & Photo" },
  { value: "phones", label: "Cell Phones & Accessories" },
  { value: "fashion", label: "Clothing, Shoes & Accessories" },
  { value: "coins", label: "Coins & Paper Money" },
  { value: "collectibles", label: "Collectibles" },
  { value: "computers", label: "Computers/Tablets & Networking" },
  { value: "electronics", label: "Consumer Electronics" },
  { value: "crafts", label: "Crafts" },
  { value: "dolls", label: "Dolls & Bears" },
  { value: "movies", label: "Movies & TV" },
  { value: "motors", label: "Nexlo Motors" },
  { value: "memorabilia", label: "Entertainment Memorabilia" },
  { value: "gift-cards", label: "Gift Cards & Coupons" },
  { value: "health-beauty", label: "Health & Beauty" },
  { value: "home-garden", label: "Home & Garden" },
  { value: "jewelry", label: "Jewelry & Watches" },
  { value: "music", label: "Music" },
  { value: "instruments", label: "Musical Instruments & Gear" },
  { value: "pets", label: "Pet Supplies" },
  { value: "pottery", label: "Pottery & Glass" },
  { value: "real-estate", label: "Real Estate" },
  { value: "services", label: "Specialty Services" },
  { value: "sports", label: "Sporting Goods" },
  { value: "sports-cards", label: "Sports Mem, Cards & Fan Shop" },
  { value: "stamps", label: "Stamps" },
  { value: "tickets", label: "Tickets & Experiences" },
  { value: "toys", label: "Toys & Hobbies" },
  { value: "travel", label: "Travel" },
  { value: "video-games", label: "Video Games & Consoles" },
  { value: "everything-else", label: "Everything Else" },
];

export function SearchCategoryMenu() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("all");
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = categories.find((item) => item.value === value) ?? categories[0];

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative z-50 hidden shrink-0 md:block">
      <input type="hidden" name="category" value={value} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((next) => !next)}
        className="flex max-w-[168px] items-center gap-1.5 bg-transparent pr-1 text-[14px] text-[#191919]"
      >
        <span className="truncate">{current.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="shrink-0" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="All Categories"
          className="absolute right-0 top-[calc(100%+16px)] max-h-[360px] w-[250px] overflow-y-auto rounded-md border border-[#e6e6e6] bg-white py-1 shadow-[0_10px_28px_-12px_rgba(0,0,0,0.35)]"
        >
          {categories.map((item) => {
            const selected = item.value === value;
            return (
              <li key={item.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setValue(item.value);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-[7px] text-left text-[14px] ${
                    selected ? "bg-[#3665f3] text-white" : "text-[#191919] hover:bg-[#3665f3] hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

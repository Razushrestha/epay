"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

type Group = { title: string; href: string; items: { name: string; href: string }[] };

const search = (q: string) => `/search?q=${encodeURIComponent(q)}`;

const columns: Group[][] = [
  [
    {
      title: "Motors",
      href: "/categories/motors",
      items: [
        { name: "Parts & accessories", href: search("parts and accessories") },
        { name: "Cars & trucks", href: search("cars and trucks") },
        { name: "Motorcycles", href: search("motorcycles") },
        { name: "Other vehicles", href: search("vehicles") },
      ],
    },
    {
      title: "Clothing & Accessories",
      href: "/categories/fashion",
      items: [
        { name: "Women", href: search("women clothing") },
        { name: "Men", href: search("men clothing") },
        { name: "Handbags", href: search("handbags") },
        { name: "Collectible Sneakers", href: search("sneakers") },
      ],
    },
    {
      title: "Sporting goods",
      href: "/categories/sports",
      items: [
        { name: "Hunting Equipment", href: search("hunting equipment") },
        { name: "Golf Equipment", href: search("golf equipment") },
      ],
    },
  ],
  [
    {
      title: "Electronics",
      href: "/categories/electronics",
      items: [
        { name: "Computers, Tablets & Network Hardware", href: search("computers tablets") },
        { name: "Cell Phones, Smart Watches & Accessories", href: search("phones watches") },
        { name: "Video Games & Consoles", href: search("video games") },
        { name: "Cameras & Photo", href: search("cameras") },
      ],
    },
    {
      title: "Business & Industrial",
      href: "/categories/industrial",
      items: [
        { name: "Modular & Pre-Fabricated Buildings", href: search("modular buildings") },
        { name: "Test, Measurement & Inspection Equipment", href: search("test equipment") },
        { name: "Heavy Equipment, Parts & Attachments", href: search("heavy equipment") },
        { name: "Restaurant & Food Service", href: search("restaurant equipment") },
      ],
    },
    {
      title: "Jewelry & Watches",
      href: search("jewelry watches"),
      items: [
        { name: "Luxury Watches", href: search("luxury watches") },
        { name: "Wristwatches", href: search("wristwatches") },
      ],
    },
  ],
  [
    {
      title: "Collectibles & Art",
      href: "/categories/collectibles",
      items: [
        { name: "Trading Cards", href: search("trading cards") },
        { name: "Collectibles", href: "/categories/collectibles" },
        { name: "Coins & Paper Money", href: search("coins") },
        { name: "Sports Memorabilia", href: search("sports memorabilia") },
      ],
    },
    {
      title: "Home & garden",
      href: "/categories/home-garden",
      items: [
        { name: "Yard, Garden & Outdoor Living Items", href: search("garden") },
        { name: "Tools & Workshop Equipment", href: search("tools") },
        { name: "Home Improvement", href: search("home improvement") },
        { name: "Kitchen, Dining & Bar Supplies", href: search("kitchen") },
      ],
    },
    {
      title: "Other categories",
      href: "/deals",
      items: [
        { name: "Books, Movies & Music", href: search("books") },
        { name: "Toys & Hobbies", href: search("toys") },
      ],
    },
  ],
];

export function CategoryMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

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
    <div ref={rootRef} className="relative z-50 hidden shrink-0 xl:block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 text-[12px] leading-tight text-[#555] hover:text-black"
      >
        <span className="text-left">
          Shop by
          <br />
          category
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          className={`transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute left-0 top-[calc(100%+14px)] z-50 w-[760px] overflow-hidden rounded-lg border border-[#ececec] bg-white shadow-[0_12px_40px_-16px_rgba(0,0,0,0.28)]"
        >
          <div className="grid max-h-[min(70vh,520px)] grid-cols-3 gap-x-8 overflow-y-auto px-6 py-5">
            {columns.map((column) => (
              <div key={column[0].title} className="space-y-6">
                {column.map((group) => (
                  <div key={group.title}>
                    <Link
                      href={group.href}
                      onClick={() => setOpen(false)}
                      className="text-[14px] font-bold text-[#191919] hover:underline"
                    >
                      {group.title}
                    </Link>
                    <ul className="mt-2.5 space-y-2">
                      {group.items.map((item) => (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className="text-[13.5px] text-[#555] hover:text-[#3665f3] hover:underline"
                          >
                            {item.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

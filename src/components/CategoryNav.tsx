"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BeautyHub } from "@/components/browse/BeautyHub";
import { CollectiblesHub } from "@/components/browse/CollectiblesHub";
import { ElectronicsHub } from "@/components/browse/ElectronicsHub";
import { FashionHub } from "@/components/browse/FashionHub";
import { HomeGardenHub } from "@/components/browse/HomeGardenHub";
import { IndustrialHub } from "@/components/browse/IndustrialHub";
import { MotorsHub } from "@/components/browse/MotorsHub";
import { SellHub } from "@/components/browse/SellHub";
import { SportsHub } from "@/components/browse/SportsHub";
import { categorySearchHref, fetchCategoryTree, type CatalogNode } from "@/lib/catalog";

const hubs = {
  Electronics: ElectronicsHub,
  Motors: MotorsHub,
  Fashion: FashionHub,
  "Collectibles & Art": CollectiblesHub,
  Collectibles: CollectiblesHub,
  Sports: SportsHub,
  "Health & Beauty": BeautyHub,
  "Industrial Equipment": IndustrialHub,
  Industrial: IndustrialHub,
  "Home & Garden": HomeGardenHub,
  Sell: SellHub,
} as const;

type NavItem = { name: string; href: string; hub?: string };

const extras: NavItem[] = [
  { name: "Saved", href: "/watchlist" },
  { name: "Deals", href: "/deals" },
  { name: "Sell", href: "/sell", hub: "Sell" },
];

export function CategoryNav() {
  const [open, setOpen] = useState<string | null>(null);
  const [categories, setCategories] = useState<CatalogNode[]>([]);

  useEffect(() => {
    fetchCategoryTree()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const items: NavItem[] = [
    extras[0],
    ...categories.map((cat) => ({ name: cat.name, href: categorySearchHref(cat.id), hub: cat.name })),
    extras[1],
    extras[2],
  ];
  const Hub = open && open in hubs ? hubs[open as keyof typeof hubs] : null;
  const liveGroup = categories.find((cat) => cat.name === open);

  return (
    <nav
      className="relative border-b border-[#e7eef6] bg-white"
      onMouseLeave={() => setOpen(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(null);
      }}
    >
      <ul className="mx-auto hidden w-full max-w-[1080px] items-center justify-center gap-x-7 py-2.5 text-[13px] text-[#0f1c3f] md:flex">
        {items.map((item) => (
          <li key={item.name} onMouseEnter={() => setOpen(item.hub ?? null)}>
            <Link
              href={item.href}
              onClick={() => setOpen(null)}
              className={`whitespace-nowrap hover:text-[#3665f3] hover:underline ${
                open === (item.hub ?? null) ? "text-[#3665f3] underline" : ""
              }`}
            >
              {item.name}
            </Link>
          </li>
        ))}
      </ul>

      <ul className="page-shell no-scrollbar flex gap-5 overflow-x-auto py-2.5 text-[13px] text-[#0f1c3f] md:hidden">
        {items.map((item) => (
          <li key={item.name} className="shrink-0">
            <Link href={item.href} className="whitespace-nowrap">
              {item.name}
            </Link>
          </li>
        ))}
      </ul>

      {(liveGroup?.children || []).length || Hub ? (
        <div className="absolute left-0 right-0 top-full z-50 hidden md:block">
          <div className="page-shell border-t border-[#eee] bg-white pb-5 pt-3 shadow-[0_16px_40px_-24px_rgba(15,28,63,0.35)]">
            {(liveGroup?.children || []).length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(liveGroup?.children || []).map((child) => (
                  <div key={child.id}>
                    <Link
                      href={categorySearchHref(child.id)}
                      onClick={() => setOpen(null)}
                      className="text-[14px] font-semibold text-[#0f1c3f] hover:text-[#3665f3] hover:underline"
                    >
                      {child.name}
                    </Link>
                    {(child.children || []).length ? (
                      <ul className="mt-2 space-y-1">
                        {(child.children || []).map((leaf) => (
                          <li key={leaf.id}>
                            <Link
                              href={categorySearchHref(leaf.id)}
                              onClick={() => setOpen(null)}
                              className="text-[13px] text-[#3a4a66] hover:text-[#3665f3] hover:underline"
                            >
                              {leaf.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : Hub ? (
              <Hub />
            ) : null}
          </div>
        </div>
      ) : null}
    </nav>
  );
}

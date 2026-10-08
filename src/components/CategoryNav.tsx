"use client";

import Link from "next/link";
import { useState } from "react";
import { BeautyHub } from "@/components/browse/BeautyHub";
import { CollectiblesHub } from "@/components/browse/CollectiblesHub";
import { ElectronicsHub } from "@/components/browse/ElectronicsHub";
import { FashionHub } from "@/components/browse/FashionHub";
import { HomeGardenHub } from "@/components/browse/HomeGardenHub";
import { IndustrialHub } from "@/components/browse/IndustrialHub";
import { MotorsHub } from "@/components/browse/MotorsHub";
import { SellHub } from "@/components/browse/SellHub";
import { SportsHub } from "@/components/browse/SportsHub";
import { navCategories } from "@/lib/home-data";

const hubs = {
  Electronics: ElectronicsHub,
  Motors: MotorsHub,
  Fashion: FashionHub,
  "Collectibles & Art": CollectiblesHub,
  Sports: SportsHub,
  "Health & Beauty": BeautyHub,
  "Industrial Equipment": IndustrialHub,
  "Home & Garden": HomeGardenHub,
  Sell: SellHub,
} as const;

function hrefFor(item: string) {
  if (item === "Sell") return "/sell";
  if (item === "Deals") return "/deals";
  if (item === "Saved") return "/watchlist";
  return `/categories/${item.toLowerCase().replace(/ & /g, "-").replace(/\s+/g, "-")}`;
}

export function CategoryNav() {
  const [open, setOpen] = useState<string | null>(null);
  const Hub = open && open in hubs ? hubs[open as keyof typeof hubs] : null;

  return (
    <nav
      className="relative border-b border-[#e5e5e5]"
      onMouseLeave={() => setOpen(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(null);
      }}
    >
      <ul className="mx-auto hidden w-full max-w-[1080px] items-center justify-center gap-x-7 py-2.5 text-[13px] text-[#191919] lg:flex">
        {navCategories.map((item) => (
          <li key={item} onMouseEnter={() => setOpen(item in hubs ? item : null)}>
            <Link
              href={hrefFor(item)}
              onClick={() => setOpen(null)}
              className={`whitespace-nowrap hover:text-[#3665f3] hover:underline ${
                open === item ? "text-[#3665f3] underline" : ""
              }`}
            >
              {item}
            </Link>
          </li>
        ))}
      </ul>

      <ul className="page-shell no-scrollbar flex gap-5 overflow-x-auto py-2.5 text-[13px] text-[#191919] lg:hidden">
        {navCategories.map((item) => (
          <li key={item} className="shrink-0">
            <Link href={hrefFor(item)} className="whitespace-nowrap">
              {item}
            </Link>
          </li>
        ))}
      </ul>

      {Hub ? (
        <div className="absolute left-0 right-0 top-full z-50 hidden lg:block">
          <div className="page-shell pb-4 pt-2">
            <Hub />
          </div>
        </div>
      ) : null}
    </nav>
  );
}

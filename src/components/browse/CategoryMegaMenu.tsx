import Link from "next/link";
import { categorySearchHref, type CatalogNode } from "@/lib/catalog";

type Promo = {
  bg: string;
  ink: string;
  title: string;
  text: string;
  cta: string;
  emoji: [string, string, string];
};

const PROMOS: Record<string, Promo> = {
  "banknotes-coins": {
    bg: "#f6c453",
    ink: "#4a3300",
    title: "Coins & banknotes",
    text: "Circulated to uncirculated, national and international.",
    cta: "Shop coins & notes",
    emoji: ["🪙", "💵", "🏛️"],
  },
  stamps: {
    bg: "#c9b8f5",
    ink: "#2b1a63",
    title: "Stamps",
    text: "Used, new and special edition stamps from around the world.",
    cta: "Shop stamps",
    emoji: ["✉️", "📮", "🌍"],
  },
  "medals-tokens": {
    bg: "#ffb199",
    ink: "#5a1f0c",
    title: "Medals & tokens",
    text: "Honours, commemoratives and collectible tokens.",
    cta: "Shop medals & tokens",
    emoji: ["🏅", "🎖️", "🥇"],
  },
  "antiques-collectibles": {
    bg: "#d9c3a0",
    ink: "#3e2a10",
    title: "Antiques & collectibles",
    text: "Rare finds with history, one of a kind.",
    cta: "Shop antiques",
    emoji: ["🏺", "🕰️", "🗝️"],
  },
  "trading-cards": {
    bg: "#8fd3f4",
    ink: "#0b3550",
    title: "Trading cards",
    text: "Sports, games and graded cards for every collector.",
    cta: "Shop trading cards",
    emoji: ["🃏", "🎴", "⭐"],
  },
  "image-video-rights": {
    bg: "#f4a6c0",
    ink: "#5a0f2e",
    title: "Image & video rights",
    text: "License photos and footage, delivered digitally.",
    cta: "Shop rights",
    emoji: ["🖼️", "🎬", "📷"],
  },
  "autographed-items": {
    bg: "#b7c4d6",
    ink: "#14233b",
    title: "Autographed items",
    text: "Certified and standard signed memorabilia.",
    cta: "Shop autographs",
    emoji: ["✍️", "🏆", "📜"],
  },
  "limited-edition-items": {
    bg: "#9fd8cf",
    ink: "#08343a",
    title: "Special & limited editions",
    text: "Numbered runs and rare releases you will not see twice.",
    cta: "Shop limited editions",
    emoji: ["💎", "🎁", "✨"],
  },
  "luxury-items": {
    bg: "#2d2a4a",
    ink: "#ffffff",
    title: "Luxury items",
    text: "Watches, bags, shoes and more, approved before they list.",
    cta: "Shop luxury",
    emoji: ["⌚", "👜", "👟"],
  },
  others: {
    bg: "#2ec8c4",
    ink: "#08343a",
    title: "Homes, land, bikes & cars",
    text: "Big-ticket items sold by auction.",
    cta: "Browse others",
    emoji: ["🏠", "🚗", "🏍️"],
  },
};

const FALLBACK: Promo = {
  bg: "#2ec8c4",
  ink: "#08343a",
  title: "",
  text: "Discover great finds.",
  cta: "Shop now",
  emoji: ["🛍️", "⭐", "🎁"],
};

const headingClass = "block border-b border-[#e6e6e6] pb-2 text-[15px] font-bold text-[#0f1c3f] hover:text-[#3665f3]";
const linkClass = "text-[14px] leading-snug text-[#333] hover:text-[#3665f3] hover:underline";

export function CategoryMegaMenu({ category, onNavigate }: { category: CatalogNode; onNavigate?: () => void }) {
  const promo = PROMOS[category.slug] ?? FALLBACK;
  const children = category.children || [];
  const withLeaves = children.filter((child) => (child.children || []).length > 0);
  const plain = children.filter((child) => !(child.children || []).length);

  return (
    <section className="overflow-hidden rounded-[22px] border border-[#ececec] bg-white p-5 shadow-[0_8px_30px_-24px_rgba(0,0,0,0.35)] sm:p-6 lg:p-7">
      <div className="grid items-stretch gap-6 lg:grid-cols-[1.05fr_1.15fr]">
        <div
          className="grid grid-cols-1 content-start gap-8 sm:grid-cols-2"
        >
          {children.length ? (
            <>
              {withLeaves.map((child) => (
                <div key={child.id}>
                  <Link href={categorySearchHref(child.id)} onClick={onNavigate} className={headingClass}>
                    {child.name}
                  </Link>
                  <ul className="mt-3 space-y-3">
                    {(child.children || []).map((leaf) => (
                      <li key={leaf.id}>
                        <Link href={categorySearchHref(leaf.id)} onClick={onNavigate} className={linkClass}>
                          {leaf.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {plain.length ? (
                <div className={plain.length > 4 ? "sm:col-span-2" : undefined}>
                  <Link href={categorySearchHref(category.id)} onClick={onNavigate} className={headingClass}>
                    {withLeaves.length ? "More" : `Shop ${category.name}`}
                  </Link>
                  <ul className={`mt-3 ${plain.length > 4 ? "grid grid-cols-2 gap-x-8 gap-y-3" : "space-y-3"}`}>
                    {plain.map((child) => (
                      <li key={child.id}>
                        <Link href={categorySearchHref(child.id)} onClick={onNavigate} className={linkClass}>
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <div>
              <h2 className="border-b border-[#e6e6e6] pb-2 text-[15px] font-bold text-[#0f1c3f]">Shop {category.name}</h2>
              <ul className="mt-3 space-y-3">
                <li>
                  <Link href={categorySearchHref(category.id)} onClick={onNavigate} className={linkClass}>
                    All {category.name}
                  </Link>
                </li>
                <li>
                  <Link href="/deals" onClick={onNavigate} className={linkClass}>
                    Today&apos;s deals
                  </Link>
                </li>
                <li>
                  <Link href="/sell" onClick={onNavigate} className={linkClass}>
                    Sell yours
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </div>

        <div
          className="relative flex min-h-[240px] flex-col justify-center overflow-hidden rounded-[22px] px-7 py-8 sm:px-8"
          style={{ backgroundColor: promo.bg, color: promo.ink }}
        >
          <h2 className="max-w-[220px] text-[32px] font-extrabold leading-[1.04] tracking-tight">
            {promo.title || category.name}
          </h2>
          <p className="mt-2 max-w-[220px] text-[15px] font-semibold leading-snug">{promo.text}</p>
          <Link
            href={categorySearchHref(category.id)}
            onClick={onNavigate}
            className="mt-6 inline-flex w-fit items-center rounded-full border px-5 py-2 text-[14px] font-semibold hover:bg-black/5"
            style={{ borderColor: promo.ink }}
          >
            {promo.cta}
          </Link>

          <div aria-hidden className="pointer-events-none absolute bottom-3 right-2 hidden h-[200px] w-[300px] xl:block">
            <span className="absolute left-0 top-2 flex h-[150px] w-[120px] items-center justify-center rounded-[16px] bg-white/55 text-[64px] shadow-md">
              {promo.emoji[0]}
            </span>
            <span className="absolute right-[80px] top-8 flex h-[130px] w-[120px] items-center justify-center rounded-[16px] bg-white/70 text-[56px] shadow-md">
              {promo.emoji[1]}
            </span>
            <span className="absolute bottom-1 right-0 flex h-[120px] w-[110px] items-center justify-center rounded-[16px] bg-white/45 text-[52px] shadow-md">
              {promo.emoji[2]}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

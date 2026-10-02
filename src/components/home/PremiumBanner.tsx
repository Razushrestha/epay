import Image from "next/image";
import Link from "next/link";
import { premiumPicks } from "@/lib/home-data";

export function PremiumBanner() {
  return (
    <section className="page-shell pt-6">
      <div className="flex flex-col overflow-hidden rounded-[18px] bg-[#161616] lg:h-[248px] lg:flex-row lg:items-center">
        <div className="px-7 py-8 text-white sm:px-10 lg:w-[38%] lg:shrink-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">
            Premium picks
          </p>
          <h2 className="mt-2 text-[24px] font-bold leading-tight sm:text-[28px]">
            Endless accessories.
            <br />
            Epic prices.
          </h2>
          <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-[#c9c9c9]">
            Upgrade your gear with top-rated accessories, from tech to travel.
          </p>
          <Link
            href="/categories/electronics"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/70 px-5 py-2 text-[13px] font-medium text-white hover:bg-white/10"
          >
            Shop accessories
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 px-4 pb-5 sm:grid-cols-4 lg:flex-1 lg:px-0 lg:py-4 lg:pr-6">
          {premiumPicks.map((p, i) => (
            <span
              key={p.label}
              className="relative aspect-[5/6] overflow-hidden rounded-[18px] bg-[#1c1c1c]"
            >
              <Image
                src={p.img}
                alt={p.label}
                fill
                sizes="(min-width: 1024px) 16vw, 40vw"
                className={`object-cover ${i === 2 ? "origin-center -rotate-6 scale-110" : ""}`}
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

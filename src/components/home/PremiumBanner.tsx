import Image from "next/image";
import Link from "next/link";
import { premiumPicks } from "@/lib/home-data";

export function PremiumBanner() {
  return (
    <section className="page-shell pt-6">
      <div className="grid overflow-hidden rounded-[14px] bg-[#111111] lg:grid-cols-[1fr_1.4fr]">
        <div className="px-7 py-8 text-white sm:px-10 sm:py-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">
            Premium picks
          </p>
          <h2 className="mt-2 text-[24px] font-bold leading-tight sm:text-[27px]">
            Endless accessories. Epic prices.
          </h2>
          <p className="mt-2 text-[12.5px] text-[#c9c9c9]">
            Upgrade your gear with top-rated accessories, from tech to travel.
          </p>
          <Link
            href="/categories/electronics"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/50 px-5 py-2 text-[13px] font-medium text-white hover:bg-white/10"
          >
            Shop accessories
            <span aria-hidden>→</span>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          {premiumPicks.map((p) => (
            <span key={p.label} className="overflow-hidden rounded-xl bg-[#2a2a2a]">
              <Image
                src={p.img}
                alt={p.label}
                width={300}
                height={240}
                className="h-[110px] w-full object-cover sm:h-[132px]"
                loading="lazy"
              />
              <span className="block px-3 py-2 text-[11.5px] text-[#e5e5e5]">{p.label}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

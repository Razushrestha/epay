"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { heroRightImages } from "@/lib/home-data";

const slides = [
  {
    eyebrow: "Welcome to Nexlo",
    title: "All your favorites in one place",
    body: "Discover great deals, unique finds and top brands from around the world.",
    cta: "Shop now",
    href: "/shop",
  },
  {
    eyebrow: "Auctions ending soon",
    title: "Bid live. Win it before it's gone",
    body: "Proxy bidding, real-time price updates and fair soft-close rules.",
    cta: "View auctions",
    href: "/deals",
  },
  {
    eyebrow: "Buyer protection",
    title: "Shop with confidence, every order",
    body: "Escrow payments, easy returns and 24/7 support across Nepal.",
    cta: "How it works",
    href: "/help/buyer-protection",
  },
];

export function HeroSection() {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const R = heroRightImages;

  return (
    <section className="page-shell pt-3">
      <div className="hero-bg relative min-h-[300px] overflow-hidden rounded-[16px] lg:min-h-[340px]">
        <div className="relative z-10 max-w-[520px] px-6 py-8 sm:px-10 lg:py-9">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0f1c3f]">
              {slide.eyebrow}
            </p>
            <h1 className="mt-2 text-[32px] font-bold leading-[1.08] tracking-tight text-[#0f1c3f] sm:text-[40px]">
              {slide.title}
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-[#333]">
              {slide.body}
            </p>
            <Link
              href={slide.cta ? slide.href : "#"}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0f1c3f] px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#1d2f63]"
            >
              {slide.cta}
              <span aria-hidden>→</span>
            </Link>
            <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-[#333]">
              <li className="flex items-center gap-1.5">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="1" y="3" width="15" height="13" rx="1" />
                  <path d="M16 8h4l3 3v5h-7V8zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm13 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
                </svg>
                <span><b>Free shipping</b><br />on many items</span>
              </li>
              <li className="flex items-center gap-1.5">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span><b>Buyer protection</b><br />& secure payments</span>
              </li>
              <li className="flex items-center gap-1.5">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span><b>Global shipping</b><br />Millions of products</span>
              </li>
            </ul>
          </div>

          {/* right collage — fills the banner from the middle to the right edge */}
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] sm:block">
            <div className="absolute left-[4%] top-[6%] w-[42%] overflow-hidden rounded-xl bg-white shadow-lg">
              <Image src={R.main} alt="" width={520} height={340} className="h-[46%] max-h-[170px] min-h-[130px] w-full object-cover" />
            </div>
            <div className="absolute bottom-[8%] left-0 w-[40%] -rotate-3 overflow-hidden rounded-xl bg-white shadow-lg">
              <Image src={R.sneakers} alt="" width={420} height={260} className="h-[120px] w-full object-cover" />
            </div>
            <div className="absolute left-[40%] top-[18%] w-[16%] overflow-hidden rounded-xl bg-white shadow-md">
              <Image src={R.phone} alt="" width={180} height={260} className="h-[150px] w-full object-cover" />
            </div>
            <div className="absolute right-[18%] top-0 w-[34%] overflow-hidden rounded-b-xl bg-white shadow-lg">
              <Image src={R.headphones} alt="" width={320} height={220} className="h-[120px] w-full object-cover" />
            </div>
            <div className="absolute bottom-[6%] left-[38%] w-[24%] overflow-hidden rounded-xl bg-white shadow-md">
              <Image src={R.glasses} alt="" width={220} height={140} className="h-[78px] w-full object-cover" />
            </div>
            <div className="absolute bottom-0 right-[16%] w-[18%] overflow-hidden rounded-t-xl bg-white shadow-md">
              <Image src={R.watch} alt="" width={180} height={180} className="h-[110px] w-full object-cover" />
            </div>
            <div className="absolute right-0 top-[28%] w-[22%] overflow-hidden rounded-l-xl bg-white shadow-lg">
              <Image src={R.bag} alt="" width={240} height={280} className="h-[160px] w-full object-cover" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 px-6 pb-6 sm:hidden">
            {[R.main, R.sneakers, R.phone, R.headphones, R.watch, R.bag].map((s) => (
              <span key={s} className="overflow-hidden rounded-lg bg-white shadow">
                <Image src={s} alt="" width={200} height={140} className="h-[86px] w-full object-cover" />
              </span>
            ))}
          </div>

        {/* dots */}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-[7px] rounded-full transition-all ${i === index ? "w-5 bg-[#0f1c3f]" : "w-[7px] bg-[#0f1c3f]/30"}`}
            />
          ))}
        </div>

        {/* arrows */}
        <div className="absolute bottom-3 right-4 hidden items-center gap-2 sm:flex">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => setIndex((index - 1 + slides.length) % slides.length)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-lg shadow hover:bg-white"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => setIndex((index + 1) % slides.length)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-lg shadow hover:bg-white"
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}

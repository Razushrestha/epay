import Image from "next/image";
import Link from "next/link";
import { navCategories } from "@/lib/home-data";

export function SiteHeader() {
  return (
    <header className="bg-white">
      {/* ── utility strip ─────────────────────────────── */}
      <div className="border-b border-[#e5e5e5]">
        <div className="page-shell flex items-center justify-between py-[7px] text-[12px] leading-none text-[#333]">
          <div className="flex items-center gap-4">
            <span>Free shipping on millions of items</span>
            <span className="hidden text-[#ddd] sm:inline">|</span>
            <span className="hidden sm:inline">30-day returns</span>
            <span className="hidden text-[#ddd] md:inline">|</span>
            <span className="hidden md:inline">Buyer protection</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 hover:underline">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Nepal (NPR)
            </button>
            <Link href="/login" className="hover:text-[#3665f3] hover:underline">
              Sign in
            </Link>
            <Link href="/register" className="hover:text-[#3665f3] hover:underline">
              Register
            </Link>
          </div>
        </div>
      </div>

      {/* ── main bar ──────────────────────────────────── */}
      <div className="page-shell flex items-center gap-4 pb-2.5 pt-3">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Nexlo home">
          <Image
            src="/logo.png"
            alt="Nexlo — Find What Comes Next."
            width={422}
            height={145}
            className="h-[48px] w-auto rounded-[8px]"
            priority
          />
        </Link>

        <button className="hidden shrink-0 items-center gap-1 text-[12px] leading-tight text-[#555] hover:text-black xl:flex">
          <span className="text-left">
            Shop by
            <br />
            category
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <form action="/search" method="get" className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-[#d5d5d5] bg-white pl-4 pr-3 focus-within:border-[#3665f3]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#707070" strokeWidth="2.2" className="shrink-0">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <label htmlFor="site-search" className="sr-only">Search for anything</label>
            <input
              id="site-search"
              name="q"
              type="search"
              placeholder="Search for anything..."
              className="min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none placeholder:text-[#767676]"
            />
            <button type="button" aria-label="Image search" className="hidden shrink-0 text-[#555] sm:block">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
            <span className="mx-2.5 hidden h-5 w-px bg-[#e0e0e0] md:block" />
            <select
              name="category"
              defaultValue="all"
              aria-label="All Categories"
              className="hidden max-w-[148px] shrink-0 bg-transparent pr-1 text-[14px] text-[#191919] outline-none md:block"
            >
              <option value="all">All Categories</option>
              <option value="electronics">Electronics</option>
              <option value="fashion">Fashion</option>
              <option value="motors">Motors</option>
              <option value="collectibles">Collectibles & Art</option>
            </select>
          </div>
          <button
            type="submit"
            className="h-11 shrink-0 rounded-full bg-[#3665f3] px-6 text-[15px] font-semibold text-white hover:bg-[#2953c6] sm:px-7"
          >
            Search
          </button>
        </form>

        <div className="ml-2 flex shrink-0 items-center gap-5 sm:ml-4 sm:gap-6">
          <Link href="/watchlist" aria-label="Watchlist" className="text-[#333] hover:text-[#3665f3]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
            </svg>
          </Link>
          <Link href="/cart" aria-label="Cart" className="relative text-[#333] hover:text-[#3665f3]">
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* ── category nav ──────────────────────────────── */}
      <nav className="border-b border-[#e5e5e5]">
        <ul className="mx-auto hidden w-full max-w-[1080px] items-center justify-center gap-x-7 py-2.5 text-[13px] text-[#191919] lg:flex">
          {navCategories.map((item) => (
            <li key={item}>
              <Link
                href={
                  item === "Sell"
                    ? "/sell"
                    : item === "Deals"
                      ? "/deals"
                      : item === "Saved"
                        ? "/watchlist"
                        : `/categories/${item.toLowerCase().replace(/ & /g, "-").replace(/\s+/g, "-")}`
                }
                className="whitespace-nowrap hover:text-[#3665f3] hover:underline"
              >
                {item}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="page-shell no-scrollbar flex gap-5 overflow-x-auto py-2.5 text-[13px] text-[#191919] lg:hidden">
          {navCategories.map((item) => (
            <li key={item} className="shrink-0">
              <Link
                href={
                  item === "Sell"
                    ? "/sell"
                    : item === "Deals"
                      ? "/deals"
                      : item === "Saved"
                        ? "/watchlist"
                        : `/categories/${item.toLowerCase().replace(/ & /g, "-").replace(/\s+/g, "-")}`
                }
                className="whitespace-nowrap"
              >
                {item}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

import Image from "next/image";
import Link from "next/link";
import { CategoryMenu } from "@/components/CategoryMenu";
import { CategoryNav } from "@/components/CategoryNav";
import { AccountLinks } from "@/components/account/AccountLinks";
import { SearchBar } from "@/components/SearchBar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { HeaderIcons } from "@/components/commerce/HeaderIcons";

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
            <AccountLinks />
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

        <CategoryMenu />

        <SearchBar />

        <div className="ml-2 flex shrink-0 items-center gap-5 sm:ml-4 sm:gap-6">
          <NotificationBell />
          <HeaderIcons />
        </div>
      </div>

      <CategoryNav />
    </header>
  );
}

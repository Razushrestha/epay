import Image from "next/image";
import Link from "next/link";
import { CategoryMenu } from "@/components/CategoryMenu";
import { CategoryNav } from "@/components/CategoryNav";
import { AccountLinks } from "@/components/account/AccountLinks";
import { HeaderSearch } from "@/components/HeaderSearch";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { HeaderIcons } from "@/components/commerce/HeaderIconsGate";

export function SiteHeader() {
  return (
    <header className="bg-white">
      {/* ── utility strip ─────────────────────────────── */}
      <div className="border-b border-[#e7eef6] bg-[#f4f8fd]">
        <div className="page-shell flex items-center justify-between gap-3 py-[8px] text-[11px] leading-none text-[#5b6780] sm:text-[12px]">
          <div className="hidden min-w-0 items-center gap-4 sm:flex">
            <span className="truncate">Free shipping on millions of items</span>
            <span className="hidden text-[#c9d8ff] md:inline">|</span>
            <Link href="/resolution" className="hidden hover:text-[#3665f3] hover:underline md:inline">30-day returns</Link>
            <span className="hidden text-[#c9d8ff] lg:inline">|</span>
            <Link href="/buyer-protection" className="hidden hover:text-[#3665f3] hover:underline lg:inline">Buyer protection</Link>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
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
      <div className="page-shell grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 pb-2.5 pt-3 md:flex md:gap-4">
        <Link href="/" className="col-start-1 row-start-1 flex shrink-0 items-center" aria-label="Nexlo home">
          <Image
            src="/logo-transparent.png"
            alt="Nexlo: Find What Comes Next."
            width={808}
            height={256}
            className="h-9 w-auto sm:h-11 md:h-[48px]"
            priority
          />
        </Link>

        <CategoryMenu />

        <div className="col-span-3 row-start-2 min-w-0 md:col-auto md:row-auto md:flex-1">
          <HeaderSearch />
        </div>

        <div className="col-start-3 row-start-1 ml-0 flex shrink-0 items-center gap-4 sm:gap-5 md:ml-2 md:gap-6">
          <NotificationBell />
          <HeaderIcons />
        </div>
      </div>

      <CategoryNav />
    </header>
  );
}

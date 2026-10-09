import Image from "next/image";
import Link from "next/link";

const cols = [
  { h: "Buy", links: [
    { label: "Registration", href: "/register" },
    { label: "Bidding", href: "/help/faq" },
    { label: "Buyer protection", href: "/help/buyer-protection" },
    { label: "Help", href: "/help" },
  ] },
  { h: "Sell", links: [
    { label: "Start selling", href: "/sell" },
    { label: "Seller center", href: "/account?tab=selling" },
    { label: "Fees", href: "/help/selling-guide" },
    { label: "Payouts", href: "/account?tab=selling" },
  ] },
  { h: "About Nexlo", links: [
    { label: "Company info", href: "/help/faq" },
    { label: "Returns", href: "/help/returns" },
    { label: "Trust & safety", href: "/help/buyer-protection" },
    { label: "Contact", href: "/help" },
  ] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[#e5e5e5] bg-[#f7f7f7]">
      <div className="page-shell grid gap-8 py-10 sm:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <Image
            src="/logo.png"
            alt="Nexlo — Find What Comes Next."
            width={422}
            height={145}
            className="h-[52px] w-auto rounded-[8px]"
          />
          <p className="mt-2 max-w-[260px] text-[12px] leading-relaxed text-[#707070]">
            Auctions, fixed-price deals and Best Offer — with escrow, returns and dispute protection.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.h}>
            <p className="text-[13px] font-bold text-[#191919]">{c.h}</p>
            <ul className="mt-3 space-y-2 text-[12.5px] text-[#555]">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="hover:text-[#3665f3] hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-[#e5e5e5]">
        <p className="page-shell py-4 text-center text-[11.5px] text-[#707070] sm:text-left">
          © {new Date().getFullYear()} Nexlo · Prices in NPR ·{" "}
          <Link href="/privacy" className="hover:text-[#3665f3] hover:underline">Privacy</Link>
          {" · "}
          <Link href="/terms" className="hover:text-[#3665f3] hover:underline">Terms</Link>
        </p>
      </div>
    </footer>
  );
}

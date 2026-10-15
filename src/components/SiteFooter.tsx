import Image from "next/image";
import Link from "next/link";

const cols = [
  { h: "Buy", links: [
    { label: "Registration", href: "/register" },
    { label: "Bidding", href: "/help/faq" },
    { label: "Buyer protection", href: "/buyer-protection" },
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
    { label: "Trust & safety", href: "/buyer-protection" },
    { label: "Resolution Center", href: "/resolution" },
    { label: "Contact", href: "/help" },
  ] },
];

export function SiteFooter() {
  return (
    <footer className="mt-6 border-t border-[#e7eef6] bg-[#f4f8fd]">
      <div className="page-shell grid gap-8 py-10 sm:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <Image
            src="/logo-transparent.png"
            alt="Nexlo: Find What Comes Next."
            width={808}
            height={256}
            className="h-11 w-auto"
          />
          <p className="mt-3 max-w-[280px] text-[13px] leading-relaxed text-[#6b7587]">
            Auctions, fixed-price deals and Best Offer, with escrow, returns, and dispute protection across Nepal.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.h}>
            <p className="text-[13px] font-extrabold text-[#0f1c3f]">{c.h}</p>
            <ul className="mt-3 space-y-2 text-[13px] text-[#5b6780]">
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
      <div className="border-t border-[#e7eef6] bg-white">
        <p className="page-shell py-4 text-center text-[12px] text-[#6b7587] sm:text-left">
          © {new Date().getFullYear()} Nexlo · Prices in NPR ·{" "}
          <Link href="/privacy" className="text-[#3665f3] hover:underline">Privacy</Link>
          {" · "}
          <Link href="/terms" className="text-[#3665f3] hover:underline">Terms</Link>
        </p>
      </div>
    </footer>
  );
}

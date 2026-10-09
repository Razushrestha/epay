"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";
import { TrustBar } from "@/components/home/TrustBar";

const fallback = [
  { slug: "faq", title: "Frequently asked questions", text: "Bidding, Best Offer, escrow, and payouts." },
  { slug: "buyer-protection", title: "Buyer protection", text: "30-day window. Funds stay in escrow until the case is closed." },
  { slug: "selling-guide", title: "Selling guide", text: "List, ship, print labels, and request payouts." },
  { slug: "returns", title: "Returns policy", text: "Sellers have 3 days to respond before a case escalates." },
];

export default function HelpIndexPage() {
  const [pages, setPages] = useState<{ slug: string; title: string }[]>([]);

  useEffect(() => {
    accountApi<{ data: { slug: string; title: string }[] }>("/api/v1/help")
      .then((b) => setPages(b.data))
      .catch(() => undefined);
  }, []);

  const cards = pages.length
    ? pages.map((p) => ({ ...p, text: fallback.find((f) => f.slug === p.slug)?.text || "Read the full guide." }))
    : fallback;

  return (
    <>
      <PageHero
        eyebrow="Help centre"
        title="Shop, bid, and sell with confidence"
        body="Buyer protection, returns, selling, and FAQs — written the same way the rest of Nexlo works."
        cta="Open a support ticket"
        href="/account?tab=tickets"
      />
      <main className="page-shell py-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-[19px] font-bold text-[#191919]">Guides</h2>
            <p className="mt-[2px] text-[12px] text-[#707070]">Everything you need before you buy or list.</p>
          </div>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {cards.map((p) => (
            <li key={p.slug}>
              <Link href={`/help/${p.slug}`} className="nexlo-card block p-5 hover:shadow-md">
                <p className="text-[15px] font-bold text-[#191919]">{p.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#707070]">{p.text}</p>
                <p className="nexlo-link mt-3 text-[12.5px]">Read more →</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <TrustBar />
      <SiteFooter />
    </>
  );
}

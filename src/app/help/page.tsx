"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { BuyShell } from "@/components/commerce/BuyShell";
import { TrustBar } from "@/components/home/TrustBar";

const fallback = [
  { slug: "faq", title: "Frequently asked questions", text: "Bidding, Best Offer, escrow, and payouts." },
  { slug: "buyer-protection", title: "Buyer protection", text: "30-day window. Funds stay in escrow until the case is closed. Open Resolution Center to file." },
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
    <BuyShell
      crumbs={[
        { href: "/", label: "Home" },
        { label: "Help" },
      ]}
      title="Help"
      body="Buyer protection, returns, selling, and FAQs — the same rules that protect every order."
      aside={
        <Link href="/buyer-protection" className="nexlo-btn nexlo-btn-blue">
          Buyer Protection
        </Link>
      }
    >
      <section className="mt-6">
        <h2 className="text-[16px] font-bold text-[#0f1c3f]">Guides</h2>
        <p className="mt-1 text-[13px] text-[#6b7587]">Everything you need before you buy or list.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {cards.map((p) => (
            <li key={p.slug}>
              <Link
                href={p.slug === "buyer-protection" ? "/buyer-protection" : `/help/${p.slug}`}
                className="nexlo-card block p-5 hover:border-[#c9d8ff]"
              >
                <p className="text-[15px] font-bold text-[#0f1c3f]">{p.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#6b7587]">{p.text}</p>
                <p className="mt-3 text-[12.5px] font-semibold text-[#3665f3]">Read more →</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <div className="mt-8">
        <TrustBar />
      </div>
    </BuyShell>
  );
}

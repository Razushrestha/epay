"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { accountApi } from "@/lib/account-api";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";

const fallback: Record<string, { title: string; body: string }> = {
  faq: { title: "Frequently asked questions", body: "Bidding uses proxy bids and a soft close. Best Offer gives the seller 48 hours. Pay with eSewa or Khalti — funds stay in escrow until delivery." },
  "buyer-protection": { title: "Buyer protection", body: "You have 30 days after delivery to open a return for not as described, damaged, or wrong item. Escrow stays frozen until the case is closed." },
  "selling-guide": { title: "Selling guide", body: "Create a listing, add photos, and publish. Ship within the handling time. Request payouts to bank, eSewa, or Khalti after funds clear." },
  returns: { title: "Returns policy", body: "Sellers have 3 days to respond. If they stay silent the case escalates to Nexlo staff. Changed-mind returns depend on the listing." },
};

export default function HelpArticlePage() {
  const params = useParams<{ slug: string }>();
  const [page, setPage] = useState<{ title: string; body: string } | null>(fallback[params.slug] || null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accountApi<{ data: { title: string; body: string } }>(`/api/v1/help/${params.slug}`)
      .then((b) => setPage(b.data))
      .catch((err) => {
        if (fallback[params.slug]) setPage(fallback[params.slug]);
        else setError(err instanceof Error ? err.message : "Page not found");
      });
  }, [params.slug]);

  return (
    <>
      <PageHero
        eyebrow="Help centre"
        title={page?.title || "Loading guide…"}
        body={error || "Escrow, returns, and staff review — the same rules that protect every order on Nexlo."}
      />
      <main className="page-shell py-8">
        <Link href="/help" className="nexlo-link text-[13px]">← All guides</Link>
        {page ? (
          <article className="nexlo-card mt-4 max-w-3xl p-6 sm:p-8">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#333]">{page.body}</p>
          </article>
        ) : !error ? (
          <p className="mt-6 text-[14px] text-[#707070]">Loading…</p>
        ) : (
          <p className="mt-6 text-[14px] text-[#e53238]">{error}</p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

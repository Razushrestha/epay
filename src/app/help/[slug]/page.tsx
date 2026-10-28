"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { accountApi } from "@/lib/account-api";
import { BuyShell } from "@/components/commerce/BuyShell";

const fallback: Record<string, { title: string; body: string }> = {
  faq: { title: "Frequently asked questions", body: "Bidding uses proxy bids and a soft close. Best Offer gives the seller 48 hours. Pay with eSewa or Khalti. Funds stay in escrow until delivery." },
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
    <BuyShell
      crumbs={[
        { href: "/", label: "Home" },
        { href: "/help", label: "Help" },
        { label: page?.title || "Guide" },
      ]}
      title={page?.title || (error ? "Guide not found" : "Loading guide…")}
      body="Escrow, returns, and staff review: the same rules that protect every order on Nexlo."
      aside={
        <Link href="/help" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
          All guides →
        </Link>
      }
    >
      {error && !page ? <p className="nexlo-alert nexlo-alert-error mt-5">{error}</p> : null}
      {page ? (
        <article className="nexlo-card mt-5 max-w-3xl p-5 sm:p-6">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#3a4a66]">{page.body}</p>
          {params.slug === "returns" ? (
            <p className="mt-5 text-[14px]">
              File from the{" "}
              <Link href="/resolution" className="font-semibold text-[#3665f3] hover:underline">
                Resolution Center
              </Link>
              {" · "}
              <Link href="/buyer-protection" className="font-semibold text-[#3665f3] hover:underline">
                Buyer Protection
              </Link>
            </p>
          ) : null}
        </article>
      ) : !error ? (
        <p className="mt-6 text-[14px] text-[#6b7587]">Loading…</p>
      ) : null}
    </BuyShell>
  );
}

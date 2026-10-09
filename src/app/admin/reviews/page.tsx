"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, StatusPill, when } from "@/components/admin/admin-ui";

type Review = {
  public_id: string;
  rating: string;
  comment: string | null;
  created_at: string;
  from_name: string;
  seller_name: string;
};

export default function AdminReviewsPage() {
  const [rows, setRows] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accountApi<{ data: Review[] }>("/api/v1/admin/reviews")
      .then((b) => setRows(b.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load reviews"));
  }, []);

  const counts = {
    positive: rows.filter((r) => r.rating === "positive").length,
    neutral: rows.filter((r) => r.rating === "neutral").length,
    negative: rows.filter((r) => r.rating === "negative").length,
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Reviews</h1>
        <p className="text-[14px] text-[#6b7587]">Feedback left between buyers and sellers across Nexlo.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Positive", counts.positive, "text-[#12a37e]", "bg-[#e7fbf4]"],
          ["Neutral", counts.neutral, "text-[#6b7587]", "bg-[#eef2f7]"],
          ["Negative", counts.negative, "text-[#e5484d]", "bg-[#fdecec]"],
        ].map(([label, count, color, bg]) => (
          <section key={String(label)} className={`rounded-[22px] ${bg} p-4`}>
            <p className={`text-[13px] font-medium ${color}`}>{label}</p>
            <p className="mt-1 text-[28px] font-extrabold text-[#0f1c3f]">{count as number}</p>
          </section>
        ))}
      </div>
      <section className="overflow-hidden nexlo-card">
        {rows.map((row) => (
          <article key={row.public_id} className="border-b border-[#eef2f7] px-5 py-4 last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-[#0f1c3f]">{row.from_name} → {row.seller_name}</p>
              <span className="flex items-center gap-2">
                <StatusPill status={row.rating} />
                <span className="text-[12px] text-[#8a94a6]">{when(row.created_at)}</span>
              </span>
            </div>
            <p className="mt-2 text-[14px] text-[#3a4a66]">{row.comment || "No comment left."}</p>
          </article>
        ))}
        {!rows.length ? <Empty title="No reviews yet" sub="Feedback appears after completed purchases." /> : null}
      </section>
    </div>
  );
}

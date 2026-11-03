"use client";

import { useEffect, useMemo, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, StatusPill, when } from "@/components/admin/admin-ui";

type Review = {
  public_id: string;
  rating: string;
  comment: string | null;
  created_at: string;
  from_name: string;
  seller_name: string;
  is_hidden?: boolean;
};

type Filter = "all" | "positive" | "neutral" | "negative" | "hidden";

export default function AdminReviewsPage() {
  const [rows, setRows] = useState<Review[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const body = await accountApi<{ data: Review[] }>("/api/v1/admin/reviews");
    setRows(body.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load reviews"));
  }, []);

  const counts = useMemo(
    () => ({
      positive: rows.filter((r) => r.rating === "positive").length,
      neutral: rows.filter((r) => r.rating === "neutral").length,
      negative: rows.filter((r) => r.rating === "negative").length,
      hidden: rows.filter((r) => r.is_hidden).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    if (filter === "hidden") return rows.filter((r) => r.is_hidden);
    if (filter === "all") return rows.filter((r) => !r.is_hidden);
    return rows.filter((r) => r.rating === filter && !r.is_hidden);
  }, [rows, filter]);

  const selected = rows.find((r) => r.public_id === selectedId) || null;

  async function setHidden(hidden: boolean) {
    if (!selected) return;
    setError(null);
    if (hidden && reason.trim().length < 3) {
      setError("A reason is required when hiding a review.");
      return;
    }
    setBusy(true);
    try {
      await accountApi(`/api/v1/admin/reviews/${selected.public_id}`, {
        method: "PATCH",
        body: JSON.stringify({ hidden, reason: reason.trim() || undefined }),
      });
      setNotice(hidden ? "Review hidden from public profiles." : "Review restored.");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Reviews</h1>
        <p className="text-[14px] text-[#6b7587]">Feedback between buyers and sellers. Hide abusive or policy-violating comments.</p>
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}

      <div className="grid gap-3 sm:grid-cols-4">
        {(
          [
            { label: "Positive", count: counts.positive, color: "text-[#12a37e]", bg: "bg-[#e7fbf4]", id: "positive" },
            { label: "Neutral", count: counts.neutral, color: "text-[#6b7587]", bg: "bg-[#eef2f7]", id: "neutral" },
            { label: "Negative", count: counts.negative, color: "text-[#e5484d]", bg: "bg-[#fdecec]", id: "negative" },
            { label: "Hidden", count: counts.hidden, color: "text-[#b45309]", bg: "bg-[#fff6e5]", id: "hidden" },
          ] as const
        ).map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setFilter(card.id)}
            className={`rounded-[22px] p-4 text-left ${card.bg} ${filter === card.id ? "ring-2 ring-[#3665f3]" : ""}`}
          >
            <p className={`text-[13px] font-medium ${card.color}`}>{card.label}</p>
            <p className="mt-1 text-[28px] font-extrabold text-[#0f1c3f]">{card.count}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
            filter === "all" ? "bg-[#3665f3] text-white" : "bg-[#f4f8fd] text-[#5b6780]"
          }`}
        >
          Visible
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden nexlo-card">
          {visible.map((row) => {
            const active = selectedId === row.public_id;
            return (
              <article
                key={row.public_id}
                className={`cursor-pointer border-b border-[#eef2f7] px-5 py-4 last:border-b-0 ${active ? "bg-[#eef4ff]" : "hover:bg-[#f8fbff]"}`}
                onClick={() => setSelectedId(row.public_id)}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-[#0f1c3f]">
                    {row.from_name} → {row.seller_name}
                  </p>
                  <span className="flex items-center gap-2">
                    <StatusPill status={row.is_hidden ? "hidden" : row.rating} />
                    <span className="text-[12px] text-[#8a94a6]">{when(row.created_at)}</span>
                  </span>
                </div>
                <p className="mt-2 text-[14px] text-[#3a4a66]">{row.comment || "No comment left."}</p>
              </article>
            );
          })}
          {!visible.length ? <Empty title="No reviews in this filter" sub="Feedback appears after completed purchases." /> : null}
        </section>

        <aside className="nexlo-card h-fit p-5 xl:sticky xl:top-24">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Selected review</p>
                <h2 className="mt-1 text-[16px] font-extrabold text-[#0f1c3f]">
                  {selected.from_name} → {selected.seller_name}
                </h2>
              </div>
              <StatusPill status={selected.is_hidden ? "hidden" : selected.rating} />
              <p className="text-[14px] text-[#3a4a66]">{selected.comment || "No comment left."}</p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Reason required to hide"
                className="w-full rounded-xl border border-[#e7eef6] px-3 py-2 text-[13px]"
              />
              {selected.is_hidden ? (
                <button type="button" disabled={busy} className="nexlo-btn nexlo-btn-blue w-full" onClick={() => setHidden(false)}>
                  Restore review
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className="h-10 w-full rounded-full border border-[#f5c2c7] text-[13px] font-semibold text-[#e5484d]"
                  onClick={() => setHidden(true)}
                >
                  Hide review
                </button>
              )}
            </div>
          ) : (
            <Empty title="Select a review" sub="Hide policy-violating feedback with an audit reason." />
          )}
        </aside>
      </div>
    </div>
  );
}

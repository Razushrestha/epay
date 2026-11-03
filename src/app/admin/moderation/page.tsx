"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, StatusPill, when } from "@/components/admin/admin-ui";

type Item = {
  id: number;
  public_id: string;
  item_type: string;
  item_id: string;
  reason: string | null;
  score: number;
  decision: string | null;
  created_at: string;
};

type Filter = "pending" | "all" | "approved" | "rejected" | "flagged";

export default function AdminModerationPage() {
  const [rows, setRows] = useState<Item[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setRows((await accountApi<{ data: Item[] }>("/api/v1/admin/moderation")).data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load queue"));
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "pending") return rows.filter((r) => !r.decision);
    return rows.filter((r) => r.decision === filter);
  }, [rows, filter]);

  const selected = rows.find((r) => r.public_id === selectedId) || null;
  const pendingCount = rows.filter((r) => !r.decision).length;

  async function decide(decision: "approved" | "rejected" | "flagged") {
    if (!selected) return;
    setError(null);
    if (["rejected", "flagged"].includes(decision) && reason.trim().length < 3) {
      setError("A reason is required when rejecting or flagging.");
      return;
    }
    setBusy(true);
    try {
      await accountApi(`/api/v1/admin/moderation/${selected.id}`, {
        method: "POST",
        body: JSON.stringify({ decision, reason: reason.trim() || undefined }),
      });
      setNotice(`${selected.item_type} #${selected.item_id} → ${decision}`);
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update queue item");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Moderation</h1>
          <p className="text-[14px] text-[#6b7587]">Flagged listings, reports, and prohibited content. Reject/flag need a written reason.</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 ? (
            <span className="rounded-full bg-[#fff6e5] px-3 py-1.5 text-[13px] font-semibold text-[#b45309]">
              {pendingCount} pending
            </span>
          ) : null}
          <Link href="/admin/products" className="nexlo-btn-ghost h-10 px-4 leading-10">
            Products
          </Link>
        </div>
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pending", "Pending"],
            ["all", "All"],
            ["approved", "Approved"],
            ["rejected", "Rejected"],
            ["flagged", "Flagged"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              filter === id ? "bg-[#3665f3] text-white" : "bg-[#f4f8fd] text-[#5b6780]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="nexlo-card overflow-hidden">
          <ul className="divide-y divide-[#eef2f7]">
            {visible.map((row) => {
              const active = selectedId === row.public_id;
              return (
                <li
                  key={row.public_id}
                  className={`cursor-pointer px-4 py-3 ${active ? "bg-[#eef4ff]" : "hover:bg-[#f8fbff]"}`}
                  onClick={() => setSelectedId(row.public_id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#0f1c3f]">
                        {row.item_type} #{row.item_id}
                      </p>
                      <p className="text-[13px] text-[#6b7587]">
                        {row.reason || "No reporter reason"} · score {row.score} · {when(row.created_at)}
                      </p>
                    </div>
                    {row.decision ? <StatusPill status={row.decision} /> : <StatusPill status="pending" />}
                  </div>
                </li>
              );
            })}
          </ul>
          {!visible.length ? <Empty title="Queue is clear" sub="Flagged listings and member reports will land here." /> : null}
        </section>

        <aside className="nexlo-card h-fit p-5 xl:sticky xl:top-24">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Queue item</p>
                <h2 className="mt-1 text-[18px] font-extrabold text-[#0f1c3f]">
                  {selected.item_type} #{selected.item_id}
                </h2>
                <p className="text-[13px] text-[#6b7587]">{selected.reason || "No reporter reason"}</p>
              </div>
              {selected.decision ? <StatusPill status={selected.decision} /> : null}
              {!selected.decision ? (
                <>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Reason required for reject / flag"
                    className="w-full rounded-xl border border-[#e7eef6] px-3 py-2 text-[13px]"
                  />
                  <div className="flex flex-col gap-2">
                    <button type="button" disabled={busy} className="nexlo-btn nexlo-btn-blue" onClick={() => decide("approved")}>
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="h-10 rounded-full border border-[#f5c2c7] text-[13px] font-semibold text-[#e5484d]"
                      onClick={() => decide("rejected")}
                    >
                      Reject
                    </button>
                    <button type="button" disabled={busy} className="nexlo-btn-ghost h-10" onClick={() => decide("flagged")}>
                      Keep flagged
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-[#6b7587]">Already decided. Open Products to adjust the listing further.</p>
              )}
              {selected.item_type === "listing" ? (
                <Link href="/admin/products" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                  Open products desk →
                </Link>
              ) : null}
            </div>
          ) : (
            <Empty title="Select a queue item" sub="Review reporter reason and decide with an audit note." />
          )}
        </aside>
      </div>
    </div>
  );
}

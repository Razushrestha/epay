"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, StatusPill, money, when } from "@/components/admin/admin-ui";

type CaseRow = {
  id: number;
  public_id: string;
  order_number: string;
  case_type: string;
  status: string;
  amount_claimed: number;
  buyer: string;
  seller: string;
  opened_at: string;
};

const OUTCOMES = [
  { id: "refund_buyer", label: "Refund buyer" },
  { id: "partial_refund", label: "Partial refund" },
  { id: "side_with_seller", label: "Side with seller" },
  { id: "return_item", label: "Return item" },
] as const;

type Filter = "open" | "all" | "resolved";

export default function AdminDisputesPage() {
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]["id"]>("refund_buyer");
  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const body = await accountApi<{ data: CaseRow[] }>("/api/v1/admin/disputes");
    setRows(body.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load disputes"));
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "resolved") return rows.filter((r) => r.status === "resolved" || r.status === "closed");
    return rows.filter((r) => !["resolved", "closed"].includes(r.status));
  }, [rows, filter]);

  const selected = rows.find((r) => r.public_id === selectedId) || null;
  const openCount = rows.filter((r) => !["resolved", "closed"].includes(r.status)).length;

  async function decide() {
    if (!selected) return;
    setError(null);
    if (reason.trim().length < 3) {
      setError("Decision reason is required (min 3 characters).");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { outcome, reason: reason.trim() };
      if (outcome === "partial_refund" && refundAmount.trim()) {
        payload.refundAmount = Number(refundAmount);
      }
      await accountApi(`/api/v1/cases/${selected.public_id}/decide`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setNotice(`Case ${selected.order_number} → ${outcome.replace(/_/g, " ")}`);
      setReason("");
      setRefundAmount("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decide case");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Disputes</h1>
          <p className="text-[14px] text-[#6b7587]">Escalate, refund, or side with the seller. Escrow stays frozen until you decide.</p>
        </div>
        {openCount > 0 ? (
          <span className="rounded-full bg-[#fdecec] px-3 py-1.5 text-[13px] font-semibold text-[#e5484d]">
            {openCount} open
          </span>
        ) : null}
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["open", "Open"],
            ["all", "All"],
            ["resolved", "Resolved"],
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="nexlo-card overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="bg-[#f7fafd] text-[#6b7587]">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th>Type</th>
                <th>Parties</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Opened</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const active = selectedId === row.public_id;
                return (
                  <tr
                    key={row.public_id}
                    className={`cursor-pointer border-t border-[#eef2f7] ${active ? "bg-[#eef4ff]" : "hover:bg-[#f8fbff]"}`}
                    onClick={() => {
                      setSelectedId(row.public_id);
                      setRefundAmount(String(row.amount_claimed || ""));
                    }}
                  >
                    <td className="px-4 py-3 font-semibold text-[#3665f3]">#{row.order_number}</td>
                    <td className="uppercase tracking-wide text-[11px] text-[#8a94a6]">{row.case_type}</td>
                    <td>
                      <p className="font-medium text-[#0f1c3f]">{row.buyer}</p>
                      <p className="text-[12px] text-[#8a94a6]">vs {row.seller}</p>
                    </td>
                    <td className="font-semibold">{money(row.amount_claimed)}</td>
                    <td>
                      <StatusPill status={row.status} />
                    </td>
                    <td className="pr-4 text-[#6b7587]">{when(row.opened_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visible.length ? <Empty title="No disputes in this filter" sub="Returns that escalate will appear here for a staff decision." /> : null}
        </section>

        <aside className="nexlo-card h-fit p-5 xl:sticky xl:top-24">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Selected case</p>
                <h2 className="mt-1 text-[18px] font-extrabold text-[#0f1c3f]">#{selected.order_number}</h2>
                <p className="text-[13px] text-[#6b7587]">
                  {selected.buyer} → {selected.seller}
                </p>
              </div>
              <StatusPill status={selected.status} />
              <p className="text-[22px] font-extrabold text-[#0f1c3f]">{money(selected.amount_claimed)}</p>

              {["resolved", "closed"].includes(selected.status) ? (
                <p className="text-[13px] text-[#6b7587]">This case is already closed.</p>
              ) : (
                <>
                  <div>
                    <label className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Outcome</label>
                    <select value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)} className="mt-1 nexlo-field">
                      {OUTCOMES.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {outcome === "partial_refund" ? (
                    <div>
                      <label className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Refund amount</label>
                      <input
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        type="number"
                        min="0"
                        step="0.01"
                        className="mt-1 nexlo-field"
                      />
                    </div>
                  ) : null}
                  <div>
                    <label className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Decision reason</label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      placeholder="Required — audited and may notify parties"
                      className="mt-1 w-full rounded-xl border border-[#e7eef6] px-3 py-2 text-[13px]"
                    />
                  </div>
                  <button type="button" disabled={busy} className="nexlo-btn nexlo-btn-blue w-full" onClick={decide}>
                    {busy ? "Saving…" : "Decide case"}
                  </button>
                </>
              )}

              <div className="flex flex-col gap-1.5 border-t border-[#eef2f7] pt-3">
                <Link href="/admin/orders" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                  Orders desk →
                </Link>
                <Link href="/admin/finance" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                  Finance / refunds →
                </Link>
              </div>
            </div>
          ) : (
            <Empty title="Select a case" sub="Choose an open dispute to set outcome and reason." />
          )}
        </aside>
      </div>
    </div>
  );
}

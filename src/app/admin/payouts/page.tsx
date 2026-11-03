"use client";

import { useEffect, useMemo, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, money, StatusPill, when } from "@/components/admin/admin-ui";

type Payout = {
  public_id: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
  email: string;
  name: string;
  admin_note: string | null;
};

type Filter = "pending" | "all" | "approved" | "paid" | "rejected";

export default function AdminPayoutsPage() {
  const [rows, setRows] = useState<Payout[]>([]);
  const [integrity, setIntegrity] = useState<{ debit: number; credit: number; balanced: boolean } | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [note, setNote] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const body = await accountApi<{ data: Payout[]; integrity: { debit: number; credit: number; balanced: boolean } }>(
      "/api/v1/admin/payouts",
    );
    setRows(body.data);
    setIntegrity(body.integrity);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load payouts"));
  }, []);

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((row) => row.status === filter)),
    [rows, filter],
  );
  const selected = rows.find((row) => row.public_id === selectedId) || null;
  const pendingCount = rows.filter((row) => row.status === "pending").length;

  async function decide(row: Payout, status: "approved" | "paid" | "rejected", paidRef?: string) {
    setError(null);
    if (status === "rejected" && note.trim().length < 3) {
      setError("Add a rejection note (min 3 characters).");
      return;
    }
    setBusy(true);
    try {
      await accountApi(`/api/v1/admin/payouts/${row.public_id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, note: note.trim() || undefined, paidRef }),
      });
      setNotice(`Payout ${status} for ${row.name || row.email}.`);
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update payout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Payouts & ledger</h1>
          <p className="text-[14px] text-[#6b7587]">Approve seller withdrawals and confirm the double-entry ledger still balances.</p>
        </div>
        {pendingCount > 0 ? (
          <span className="rounded-full bg-[#fff6e5] px-3 py-1.5 text-[13px] font-semibold text-[#b45309]">
            {pendingCount} pending
          </span>
        ) : null}
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}
      {integrity ? (
        <p className={`nexlo-alert ${integrity.balanced ? "nexlo-alert-info" : "nexlo-alert-error"}`}>
          Ledger {integrity.balanced ? "balanced" : "imbalanced"} · debit {money(integrity.debit)} · credit {money(integrity.credit)}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pending", "Pending"],
            ["all", "All"],
            ["approved", "Approved"],
            ["paid", "Paid"],
            ["rejected", "Rejected"],
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
        <section className="nexlo-card p-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13.5px]">
              <thead>
                <tr className="border-b text-[11px] font-semibold tracking-[0.06em] text-[#8a94a6]">
                  <th className="py-3">Seller</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Requested</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.public_id}
                    className={`cursor-pointer border-b border-[#f3f6fa] ${selectedId === row.public_id ? "bg-[#eef4ff]" : "hover:bg-[#f8fbff]"}`}
                    onClick={() => setSelectedId(row.public_id)}
                  >
                    <td className="py-3">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-[12px] text-[#8a94a6]">{row.email}</p>
                    </td>
                    <td>{money(row.amount)}</td>
                    <td className="capitalize">{row.method}</td>
                    <td>
                      <StatusPill status={row.status} />
                    </td>
                    <td className="text-[#6b7587]">{when(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length ? <Empty title="No payouts in this filter" sub="Seller withdrawal requests appear here after escrow releases." /> : null}
          </div>
        </section>

        <aside className="nexlo-card h-fit p-5 xl:sticky xl:top-24">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Selected payout</p>
                <h2 className="mt-1 text-[18px] font-extrabold text-[#0f1c3f]">{selected.name || selected.email}</h2>
                <p className="text-[13px] text-[#6b7587]">{selected.email}</p>
              </div>
              <p className="text-[24px] font-extrabold text-[#0f1c3f]">{money(selected.amount)}</p>
              <StatusPill status={selected.status} />
              {selected.admin_note ? <p className="text-[13px] text-[#6b7587]">Note: {selected.admin_note}</p> : null}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Staff note (required to reject)"
                className="w-full rounded-xl border border-[#e7eef6] px-3 py-2 text-[13px]"
              />
              <div className="flex flex-col gap-2">
                {selected.status === "pending" ? (
                  <>
                    <button type="button" disabled={busy} className="nexlo-btn nexlo-btn-blue" onClick={() => decide(selected, "approved")}>
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="nexlo-btn-ghost h-10"
                      onClick={async () => {
                        await decide(selected, "approved");
                        await decide(selected, "paid", "manual");
                      }}
                    >
                      Approve & mark paid
                    </button>
                    <button type="button" disabled={busy} className="h-10 rounded-full border border-[#f5c2c7] text-[13px] font-semibold text-[#e5484d]" onClick={() => decide(selected, "rejected")}>
                      Reject
                    </button>
                  </>
                ) : null}
                {selected.status === "approved" ? (
                  <button type="button" disabled={busy} className="nexlo-btn nexlo-btn-blue" onClick={() => decide(selected, "paid", "manual")}>
                    Mark paid
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <Empty title="Select a payout" sub="Review amount and ledger balance before approving." />
          )}
        </aside>
      </div>
    </div>
  );
}

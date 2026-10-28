"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, money, StatusPill } from "@/components/admin/admin-ui";

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

export default function AdminPayoutsPage() {
  const [rows, setRows] = useState<Payout[]>([]);
  const [integrity, setIntegrity] = useState<{ debit: number; credit: number; balanced: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const body = await accountApi<{ data: Payout[]; integrity: { debit: number; credit: number; balanced: boolean } }>("/api/v1/admin/payouts");
    setRows(body.data);
    setIntegrity(body.integrity);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load payouts"));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Payouts & ledger</h1>
        <p className="text-[14px] text-[#6b7587]">Approve seller withdrawals and confirm the double-entry ledger still balances.</p>
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {integrity ? (
        <p className={`nexlo-alert ${integrity.balanced ? "nexlo-alert-ok" : "nexlo-alert-error"}`}>
          Ledger {integrity.balanced ? "balanced" : "imbalanced"} · debit {money(integrity.debit)} · credit {money(integrity.credit)}
        </p>
      ) : null}
      <section className="nexlo-card p-5">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13.5px]">
          <thead>
            <tr className="border-b text-[11px] font-semibold tracking-[0.06em] text-[#8a94a6]">
              <th className="py-3">Seller</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.public_id} className="border-b border-[#f3f6fa]">
                <td className="py-3">
                  <p className="font-medium">{row.name}</p>
                  <p className="text-[12px] text-[#8a94a6]">{row.email}</p>
                </td>
                <td>{money(row.amount)}</td>
                <td className="capitalize">{row.method}</td>
                <td><StatusPill status={row.status} /></td>
                <td className="space-x-2">
                  {row.status === "pending" ? (
                    <>
                      <button type="button" className="text-[#12a37e]" onClick={async () => { await accountApi(`/api/v1/admin/payouts/${row.public_id}`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) }); await load(); }}>Approve</button>
                      <button type="button" className="text-[#3665f3]" onClick={async () => {
                        await accountApi(`/api/v1/admin/payouts/${row.public_id}`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) });
                        await accountApi(`/api/v1/admin/payouts/${row.public_id}`, { method: "PATCH", body: JSON.stringify({ status: "paid", paidRef: "manual" }) });
                        await load();
                      }}>Mark paid</button>
                      <button type="button" className="text-[#e5484d]" onClick={async () => { await accountApi(`/api/v1/admin/payouts/${row.public_id}`, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) }); await load(); }}>Reject</button>
                    </>
                  ) : row.status === "approved" ? (
                    <button type="button" className="text-[#3665f3]" onClick={async () => { await accountApi(`/api/v1/admin/payouts/${row.public_id}`, { method: "PATCH", body: JSON.stringify({ status: "paid", paidRef: "manual" }) }); await load(); }}>Mark paid</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <Empty title="No payouts yet" sub="Seller withdrawal requests appear here after escrow releases." /> : null}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, StatusPill, money } from "@/components/admin/admin-ui";

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

export default function AdminDisputesPage() {
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const body = await accountApi<{ data: CaseRow[] }>("/api/v1/admin/disputes");
    setRows(body.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load disputes"));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Disputes</h1>
        <p className="text-[14px] text-[#6b7587]">Escalate, refund, or side with the seller. Escrow stays frozen until you decide.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-[#eaf1ff] px-4 py-3 text-[13px] text-[#2a4fa8]">{notice}</p> : null}
      <div className="overflow-hidden nexlo-card">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[#f7fafd] text-[#6b7587]">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th>Type</th>
              <th>Parties</th>
              <th>Amount</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.public_id} className="border-t border-[#eef2f7]">
                <td className="px-4 py-3 font-semibold">{row.order_number}</td>
                <td className="uppercase">{row.case_type}</td>
                <td>{row.buyer} → {row.seller}</td>
                <td>{money(row.amount_claimed)}</td>
                <td><StatusPill status={row.status} /></td>
                <td className="space-x-2 py-3 pr-4">
                  {["refund_buyer", "partial_refund", "side_with_seller"].map((outcome) => (
                    <button
                      key={outcome}
                      type="button"
                      className="text-[#3665f3]"
                      onClick={async () => {
                        await accountApi(`/api/v1/cases/${row.public_id}/decide`, { method: "POST", body: JSON.stringify({ outcome, reason: "Staff decision" }) });
                        setNotice(`Case ${row.order_number} decided: ${outcome.replace(/_/g, " ")}`);
                        await load();
                      }}
                    >
                      {outcome.replace(/_/g, " ")}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <Empty title="No disputes yet" sub="Returns that escalate will appear here for a staff decision." /> : null}
      </div>
    </div>
  );
}

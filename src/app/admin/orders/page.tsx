"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { clock, Empty, money, StatusPill } from "@/components/admin/admin-ui";

type Order = {
  id: number;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  customer: string;
  customer_email: string;
  product: string | null;
  quantity: number | null;
  photo_url: string | null;
  thumbnail_url: string | null;
};

const STATUSES = ["pending_payment", "paid", "processing", "shipped", "delivered", "completed", "cancelled", "refunded"];

export default function AdminOrdersPage() {
  const [rows, setRows] = useState<Order[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const body = await accountApi<{ data: Order[] }>(`/api/v1/admin/orders?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}`);
    setRows(body.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load orders"));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Orders</h1>
        <p className="text-[14px] text-[#6b7587]">Track checkout, fulfillment, refunds, and cancellations.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      <section className="nexlo-card p-5">
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search order ID or customer" className="h-10 min-w-[220px] flex-1 rounded-lg border border-[#e2e8f0] px-3" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-[#e2e8f0] px-3">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <button className="h-10 rounded-full border px-4 text-[14px]">Filter</button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-[#eef2f7] text-[11px] font-semibold tracking-[0.06em] text-[#8a94a6]">
                <th className="py-3">Order ID</th>
                <th className="py-3">Customer</th>
                <th className="py-3">Product</th>
                <th className="py-3">Amount</th>
                <th className="py-3">Status</th>
                <th className="py-3">Date</th>
                <th className="py-3">Update</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[#f3f6fa]">
                  <td className="py-3 font-semibold text-[#3665f3]">#{row.order_number}</td>
                  <td className="py-3">
                    <p className="font-medium text-[#0f1c3f]">{row.customer}</p>
                    <p className="text-[12px] text-[#8a94a6]">{row.customer_email}</p>
                  </td>
                  <td className="py-3">
                    <span className="flex items-center gap-2">
                      {row.thumbnail_url || row.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.thumbnail_url || row.photo_url || ""} alt="" className="h-8 w-8 rounded-lg object-cover" />
                      ) : null}
                      {row.product || "—"}
                    </span>
                  </td>
                  <td className="py-3 font-semibold">{money(row.total_amount)}</td>
                  <td className="py-3"><StatusPill status={row.status} /></td>
                  <td className="py-3 text-[#6b7587]">{clock(row.created_at)}</td>
                  <td className="py-3">
                    <select
                      value={row.status}
                      className="h-9 rounded-lg border border-[#e2e8f0] px-2 text-[12px]"
                      onChange={async (e) => {
                        await accountApi(`/api/v1/admin/orders/${row.id}`, { method: "PATCH", body: JSON.stringify({ status: e.target.value }) });
                        await load();
                      }}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <Empty title="No orders yet" sub="Orders show up here after a successful checkout." /> : null}
        </div>
      </section>
    </div>
  );
}

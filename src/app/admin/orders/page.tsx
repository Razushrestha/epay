"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { accountApi } from "@/lib/account-api";
import { clock, Empty, money, StatusPill } from "@/components/admin/admin-ui";
import { SavedViewsBar } from "@/components/admin/SavedViewsBar";

type Order = {
  id: number;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  customer: string;
  customer_email: string;
  buyer_id?: string;
  product: string | null;
  quantity: number | null;
  photo_url: string | null;
  thumbnail_url: string | null;
};

const STATUSES = ["pending_payment", "paid", "processing", "shipped", "delivered", "completed", "cancelled", "refunded"];

function OrdersBoard() {
  const params = useSearchParams();
  const [rows, setRows] = useState<Order[]>([]);
  const [query, setQuery] = useState(params.get("q") || "");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState(0);

  async function load(q = query) {
    const body = await accountApi<{ data: Order[]; total?: number }>(
      `/api/v1/admin/orders?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`,
    );
    setRows(body.data);
    setTotal(body.total ?? body.data.length);
  }

  useEffect(() => {
    const q = params.get("q");
    if (q != null && q !== "") setQuery(q);
  }, [params]);

  useEffect(() => {
    load(query).catch((err) => setError(err instanceof Error ? err.message : "Could not load orders"));
  }, [status, query]);

  const selected = rows.find((row) => row.id === selectedId) || null;
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: rows.length };
    for (const s of STATUSES) map[s] = rows.filter((r) => r.status === s).length;
    return map;
  }, [rows]);

  async function setOrderStatus(order: Order, next: string) {
    setError(null);
    if ((next === "refunded" || next === "cancelled") && notes.trim().length < 3) {
      setError("Add a note (min 3 characters) before cancelling or refunding.");
      return;
    }
    setBusy(true);
    try {
      await accountApi(`/api/v1/admin/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next, notes: notes.trim() || undefined }),
      });
      setNotice(`Order #${order.order_number} → ${next.replace(/_/g, " ")}`);
      setNotes("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Orders</h1>
        <p className="text-[14px] text-[#6b7587]">
          Track checkout, fulfillment, refunds, and cancellations. Escrow hooks run on paid / completed / refunded.
          {total ? ` · ${total} matching` : ""}
        </p>
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}

      <SavedViewsBar
        desk="orders"
        role="staff"
        current={{ query, status }}
        onApply={(view) => {
          setQuery(view.query || "");
          setStatus(view.status || "");
        }}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="nexlo-card p-5">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              load().catch((err) => setError(err instanceof Error ? err.message : "Could not load orders"));
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order ID or customer"
              className="nexlo-field min-w-[220px] flex-1"
            />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="nexlo-field w-auto">
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <button className="nexlo-btn-ghost h-10 px-4">Filter</button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatus("")}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${!status ? "bg-[#3665f3] text-white" : "bg-[#f4f8fd] text-[#5b6780]"}`}
            >
              All {counts.all}
            </button>
            {(["pending_payment", "paid", "processing", "shipped", "refunded"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${status === s ? "bg-[#3665f3] text-white" : "bg-[#f4f8fd] text-[#5b6780]"}`}
              >
                {s.replace(/_/g, " ")} {counts[s] || 0}
              </button>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-[#eef2f7] text-[11px] font-semibold tracking-[0.06em] text-[#8a94a6]">
                  <th className="py-3">Order ID</th>
                  <th className="py-3">Customer</th>
                  <th className="py-3">Product</th>
                  <th className="py-3">Amount</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const active = selectedId === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={`cursor-pointer border-b border-[#f3f6fa] ${active ? "bg-[#eef4ff]" : "hover:bg-[#f8fbff]"}`}
                      onClick={() => setSelectedId(row.id)}
                    >
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
                          {row.product || "-"}
                        </span>
                      </td>
                      <td className="py-3 font-semibold">{money(row.total_amount)}</td>
                      <td className="py-3">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="py-3 text-[#6b7587]">{clock(row.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length ? <Empty title="No orders yet" sub="Orders show up here after a successful checkout." /> : null}
          </div>
        </section>

        <aside className="nexlo-card h-fit p-5 xl:sticky xl:top-24">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Selected order</p>
                <h2 className="mt-1 text-[18px] font-extrabold text-[#0f1c3f]">#{selected.order_number}</h2>
                <p className="text-[13px] text-[#6b7587]">{selected.customer}</p>
                <p className="text-[13px] text-[#6b7587]">{selected.customer_email}</p>
              </div>
              <StatusPill status={selected.status} />
              <dl className="space-y-2 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8a94a6]">Total</dt>
                  <dd className="font-semibold text-[#0f1c3f]">{money(selected.total_amount)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8a94a6]">Item</dt>
                  <dd className="text-right text-[#0f1c3f]">{selected.product || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8a94a6]">Placed</dt>
                  <dd className="text-[#0f1c3f]">{clock(selected.created_at)}</dd>
                </div>
              </dl>
              <div>
                <label className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Staff note</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Required for cancel / refund"
                  className="mt-1 w-full rounded-xl border border-[#e7eef6] px-3 py-2 text-[13px]"
                />
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Update status</p>
                <select
                  value={selected.status}
                  disabled={busy}
                  className="mt-2 nexlo-field"
                  onChange={(e) => setOrderStatus(selected, e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Link href="/admin/finance" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                  Issue refund from Finance →
                </Link>
                <Link href="/admin/disputes" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                  Open disputes →
                </Link>
                <Link href="/admin/payouts" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                  Seller payouts →
                </Link>
              </div>
            </div>
          ) : (
            <Empty title="Select an order" sub="Click a row to update status, add notes, or jump to finance tools." />
          )}
        </aside>
      </div>
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<p className="text-[14px] text-[#6b7587]">Loading orders…</p>}>
      <OrdersBoard />
    </Suspense>
  );
}

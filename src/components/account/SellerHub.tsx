"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { LineChart, money } from "@/components/admin/admin-ui";
import { SellerWallet } from "@/components/account/SellerWallet";

type Dash = {
  sales: { gmv: number; orders: number; month_gmv: number };
  pendingOrders: number;
  lowStock: number;
  metrics: { defect_rate: number; late_shipment_rate: number; cancellation_rate: number };
  vacation: { active: boolean; message?: string; hide_listings?: boolean; auto_reply?: boolean; ends_at?: string | null };
  series: { day: string; revenue: number; orders: number }[];
  wallet: { available_balance: number; pending_balance: number };
  sellerLevel?: string;
};

type Listing = { id: number; title: string; price: number; quantity: number; status: string; photo?: string | null };
type Reply = { public_id: string; title: string; body: string };

function pct(n: number) {
  return `${Math.round(Number(n || 0) * 100)}%`;
}

export function SellerHub() {
  const [dash, setDash] = useState<Dash | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [vac, setVac] = useState({ active: false, message: "", hideListings: true, autoReply: true });
  const [reply, setReply] = useState({ title: "", body: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const [d, inv, r] = await Promise.all([
      accountApi<Dash>("/api/v1/seller/dashboard"),
      accountApi<{ data: Listing[] }>("/api/v1/seller/inventory"),
      accountApi<{ data: Reply[] }>("/api/v1/seller/replies"),
    ]);
    setDash(d);
    setListings(inv.data);
    setReplies(r.data);
    setVac({
      active: Boolean(d.vacation?.active),
      message: d.vacation?.message || "",
      hideListings: d.vacation?.hide_listings !== false,
      autoReply: d.vacation?.auto_reply !== false,
    });
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load seller tools"));
  }, []);

  async function download(kind: string) {
    const body = await accountApi<{ csv: string }>(`/api/v1/seller/reports/${kind}`);
    const blob = new Blob([body.csv || ""], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexlo-${kind}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const series = dash?.series ?? [];

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-[#eaf1ff] px-4 py-3 text-[13px] text-[#2a4fa8]">{notice}</p> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["GMV", money(dash?.sales.gmv ?? 0)],
          ["This month", money(dash?.sales.month_gmv ?? 0)],
          ["To fulfil", dash?.pendingOrders ?? 0],
          ["Low stock", dash?.lowStock ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl bg-[#f7f7f7] p-4">
            <p className="text-[12px] text-[#7a8496]">{label}</p>
            <p className="mt-1 text-[20px] font-extrabold text-[#0f1c3f]">{value}</p>
          </div>
        ))}
      </div>
      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Sales (14 days)</h2>
        <LineChart
          labels={series.map((s) => new Date(s.day).getDate().toString())}
          series={[{ name: "Revenue", color: "#3665f3", values: series.map((s) => Number(s.revenue || 0)) }]}
        />
        <p className="mt-3 text-[13px] text-[#6b7587]">
          Defect {pct(dash?.metrics.defect_rate ?? 0)} · Late ship {pct(dash?.metrics.late_shipment_rate ?? 0)} · Cancel {pct(dash?.metrics.cancellation_rate ?? 0)}
        </p>
      </section>
      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Wallet</h2>
        <div className="mt-3"><SellerWallet /></div>
      </section>
      <section className="nexlo-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Inventory</h2>
          <Link href="/sell/listings" className="text-[13px] text-[#3665f3]">All listings</Link>
        </div>
        <p className="mt-1 text-[12px] text-[#8a94a6]">Edit price or quantity, then save. Low stock is 2 or fewer.</p>
        <ul className="mt-3 space-y-2">
          {listings.slice(0, 12).map((item, i) => (
            <li key={item.id} className="grid gap-2 rounded-xl bg-[#f7f7f7] px-3 py-2 sm:grid-cols-[1fr_90px_70px]">
              <span className="truncate text-[14px] font-medium">{item.title}</span>
              <input defaultValue={item.price} className="h-9 rounded-lg border px-2 text-[13px]" onBlur={(e) => { listings[i].price = Number(e.target.value); }} />
              <input defaultValue={item.quantity} className="h-9 rounded-lg border px-2 text-[13px]" onBlur={(e) => { listings[i].quantity = Number(e.target.value); }} />
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="nexlo-btn mt-3 h-9"
          onClick={async () => {
            await accountApi("/api/v1/seller/inventory/bulk", { method: "POST", body: JSON.stringify({ items: listings.map((l) => ({ id: l.id, price: l.price, quantity: l.quantity })) }) });
            setNotice("Inventory saved.");
          }}
        >
          Save bulk edits
        </button>
      </section>
      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Vacation mode</h2>
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await accountApi("/api/v1/seller/vacation", { method: "PUT", body: JSON.stringify(vac) });
            setNotice(vac.active ? "Vacation mode is on. Listings are hidden and buyers get an auto-reply." : "Vacation mode is off.");
            await load();
          }}
        >
          <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={vac.active} onChange={(e) => setVac({ ...vac, active: e.target.checked })} /> Pause selling</label>
          <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={vac.hideListings} onChange={(e) => setVac({ ...vac, hideListings: e.target.checked })} /> Hide active listings</label>
          <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={vac.autoReply} onChange={(e) => setVac({ ...vac, autoReply: e.target.checked })} /> Auto-reply to messages</label>
          <textarea value={vac.message} onChange={(e) => setVac({ ...vac, message: e.target.value })} className="min-h-20 w-full rounded-xl border px-3 py-2 text-[14px]" placeholder="I am away until…" />
          <button className="nexlo-btn nexlo-btn-blue h-9">Save vacation</button>
        </form>
      </section>
      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Saved replies</h2>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            await accountApi("/api/v1/seller/replies", { method: "POST", body: JSON.stringify(reply) });
            setReply({ title: "", body: "" });
            await load();
          }}
        >
          <input value={reply.title} onChange={(e) => setReply({ ...reply, title: e.target.value })} placeholder="Title" className="h-10 rounded-full border px-4" />
          <input value={reply.body} onChange={(e) => setReply({ ...reply, body: e.target.value })} placeholder="Message" className="h-10 rounded-full border px-4" />
          <button className="nexlo-btn h-10">Add</button>
        </form>
        <ul className="mt-3 space-y-2 text-[13px]">
          {replies.map((item) => (
            <li key={item.public_id} className="flex justify-between gap-3 rounded-xl bg-[#f7f7f7] px-3 py-2">
              <span><strong>{item.title}</strong> — {item.body}</span>
              <button type="button" className="text-red-600" onClick={async () => { await accountApi(`/api/v1/seller/replies/${item.public_id}`, { method: "DELETE" }); await load(); }}>Remove</button>
            </li>
          ))}
        </ul>
      </section>
      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Reports</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {["sales", "fees", "payouts", "returns"].map((kind) => (
            <button key={kind} type="button" className="h-9 rounded-full border px-4 text-[13px] capitalize" onClick={() => download(kind)}>
              Download {kind} CSV
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

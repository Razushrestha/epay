"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, money, StatusPill, when } from "@/components/admin/admin-ui";

type Listing = {
  id: number;
  title: string;
  price: number | null;
  status: string;
  moderation_status: string;
  format: string;
  quantity: number;
  is_featured: boolean;
  view_count: number;
  created_at: string;
  seller: string;
  category: string | null;
  photo_url: string | null;
  thumbnail_url: string | null;
};

export default function AdminProductsPage() {
  const [rows, setRows] = useState<Listing[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const body = await accountApi<{ data: Listing[] }>(`/api/v1/admin/listings?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}`);
    setRows(body.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load products"));
  }, []);

  async function patch(id: number, body: Record<string, unknown>) {
    await accountApi(`/api/v1/admin/listings/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Products</h1>
          <p className="text-[14px] text-[#6b7587]">Moderate listings, feature items, and manage the catalog.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/catalog" className="h-10 rounded-full border border-[#e2e8f0] bg-white px-4 text-[14px] font-semibold leading-10 text-[#0f1c3f]">Catalog</Link>
          <Link href="/sell/create" className="h-10 rounded-full bg-[#2f6bff] px-4 text-[14px] font-semibold leading-10 text-white">Add Product</Link>
        </div>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      <section className="rounded-[22px] border border-[#e7eef6] bg-white p-5">
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title or seller" className="h-10 min-w-[220px] flex-1 rounded-lg border border-[#e2e8f0] px-3" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-[#e2e8f0] px-3">
            <option value="">All statuses</option>
            {["draft", "active", "sold", "ended", "removed", "suspended", "pending", "approved", "rejected"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="h-10 rounded-full border px-4 text-[14px]">Filter</button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-[#eef2f7] text-[11px] font-semibold tracking-[0.06em] text-[#8a94a6]">
                <th className="py-3">Product</th>
                <th className="py-3">Seller</th>
                <th className="py-3">Price</th>
                <th className="py-3">Status</th>
                <th className="py-3">Moderation</th>
                <th className="py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[#f3f6fa]">
                  <td className="py-3">
                    <span className="flex items-center gap-2">
                      {row.thumbnail_url || row.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.thumbnail_url || row.photo_url || ""} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5f8fc] text-[#8a94a6]">▢</span>
                      )}
                      <span>
                        <span className="block font-semibold text-[#0f1c3f]">{row.title}</span>
                        <span className="text-[12px] text-[#8a94a6]">{row.category || row.format} · {row.quantity} in stock · {when(row.created_at)}</span>
                      </span>
                    </span>
                  </td>
                  <td className="py-3 text-[#3a4a66]">{row.seller}</td>
                  <td className="py-3 font-semibold">{row.price != null ? money(row.price) : "—"}</td>
                  <td className="py-3"><StatusPill status={row.status} /></td>
                  <td className="py-3"><StatusPill status={row.moderation_status} /></td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="text-[#12a37e] hover:underline" onClick={() => patch(row.id, { moderationStatus: "approved", status: "active" })}>Approve</button>
                      <button type="button" className="text-[#e5484d] hover:underline" onClick={() => patch(row.id, { moderationStatus: "rejected", status: "suspended", reason: "Does not meet listing policy" })}>Reject</button>
                      <button type="button" className="text-[#2f6bff] hover:underline" onClick={() => patch(row.id, { featured: !row.is_featured })}>{row.is_featured ? "Unfeature" : "Feature"}</button>
                      <button type="button" className="text-[#6b7587] hover:underline" onClick={() => patch(row.id, { status: "removed" })}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <Empty title="No products yet" sub="Listings appear here after sellers publish them." /> : null}
        </div>
      </section>
    </div>
  );
}

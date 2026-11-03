"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { accountApi } from "@/lib/account-api";
import { Empty, money, StatusPill, when } from "@/components/admin/admin-ui";
import { SavedViewsBar } from "@/components/admin/SavedViewsBar";

type Listing = {
  id: number;
  title: string;
  price: number | null;
  status: string;
  moderation_status: string;
  moderation_reason?: string | null;
  format: string;
  quantity: number;
  is_featured: boolean;
  view_count: number;
  created_at: string;
  seller: string;
  seller_id?: string;
  category: string | null;
  photo_url: string | null;
  thumbnail_url: string | null;
  auction_ends_at?: string | null;
  auction_current_price?: number | null;
  auction_bid_count?: number | null;
};

const STATUS_CHIPS = ["", "active", "pending", "suspended", "ended", "removed"] as const;

function ProductsBoard() {
  const params = useSearchParams();
  const [rows, setRows] = useState<Listing[]>([]);
  const [query, setQuery] = useState(params.get("q") || "");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState(0);

  async function load(q = query) {
    const body = await accountApi<{ data: Listing[]; total?: number }>(
      `/api/v1/admin/listings?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`,
    );
    setRows(body.data);
    setTotal(body.total ?? body.data.length);
  }

  useEffect(() => {
    const q = params.get("q");
    if (q != null && q !== "") setQuery(q);
  }, [params]);

  useEffect(() => {
    load(query).catch((err) => setError(err instanceof Error ? err.message : "Could not load products"));
  }, [status, query]);

  const selected = rows.find((row) => row.id === selectedId) || null;
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: rows.length };
    for (const s of STATUS_CHIPS) {
      if (!s) continue;
      map[s] = rows.filter((r) => r.status === s || r.moderation_status === s).length;
    }
    return map;
  }, [rows]);

  function toggleChecked(id: number) {
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function patch(id: number, body: Record<string, unknown>, okMsg?: string) {
    setError(null);
    if (
      (body.moderationStatus === "rejected" || body.moderationStatus === "flagged" || body.forceEndAuction) &&
      reason.trim().length < 3
    ) {
      setError("Add a reason (min 3 characters) before reject, flag, or force-end.");
      return;
    }
    setBusy(true);
    try {
      const payload = { ...body };
      if (reason.trim()) payload.reason = reason.trim();
      await accountApi(`/api/v1/admin/listings/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setNotice(okMsg || "Listing updated.");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update listing");
    } finally {
      setBusy(false);
    }
  }

  async function bulkUnpublish() {
    if (!checked.length) return;
    setError(null);
    if (reason.trim().length < 3) {
      setError("Add a reason before bulk unpublishing.");
      return;
    }
    setBusy(true);
    try {
      let ok = 0;
      for (const id of checked) {
        await accountApi(`/api/v1/admin/listings/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "removed", reason: reason.trim() }),
        });
        ok += 1;
      }
      setNotice(`Unpublished ${ok} listing${ok === 1 ? "" : "s"}.`);
      setChecked([]);
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk unpublish failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Products</h1>
          <p className="text-[14px] text-[#6b7587]">
            Moderate listings, feature items, force-end auctions, and manage the live catalog.
            {total ? ` · ${total} matching` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/moderation" className="nexlo-btn-ghost h-10 px-4 leading-10">
            Moderation
          </Link>
          <Link href="/admin/catalog" className="nexlo-btn-ghost h-10 px-4 leading-10">
            Catalog
          </Link>
          <Link href="/sell/create" className="nexlo-btn nexlo-btn-blue">
            Add Product
          </Link>
        </div>
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}

      <SavedViewsBar
        desk="products"
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
              load().catch((err) => setError(err instanceof Error ? err.message : "Could not load products"));
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or seller"
              className="nexlo-field min-w-[220px] flex-1"
            />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="nexlo-field w-auto">
              <option value="">All statuses</option>
              {["draft", "active", "sold", "ended", "removed", "suspended", "pending", "approved", "rejected"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className="nexlo-btn-ghost h-10 px-4">Filter</button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {STATUS_CHIPS.map((s) => (
              <button
                key={s || "all"}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  status === s ? "bg-[#3665f3] text-white" : "bg-[#f4f8fd] text-[#5b6780]"
                }`}
              >
                {s || "All"} {s ? counts[s] || 0 : counts.all}
              </button>
            ))}
          </div>

          {checked.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-[#fff6e5] px-3 py-2">
              <span className="text-[13px] font-semibold text-[#b45309]">{checked.length} selected</span>
              <button type="button" disabled={busy} className="nexlo-btn-ghost h-9 px-3 text-[13px]" onClick={bulkUnpublish}>
                Bulk unpublish
              </button>
              <button type="button" className="text-[12px] font-semibold text-[#6b7587]" onClick={() => setChecked([])}>
                Clear
              </button>
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-[#eef2f7] text-[11px] font-semibold tracking-[0.06em] text-[#8a94a6]">
                  <th className="py-3 pr-2">
                    <input
                      type="checkbox"
                      aria-label="Select all visible"
                      checked={rows.length > 0 && checked.length === rows.length}
                      onChange={(e) => setChecked(e.target.checked ? rows.map((r) => r.id) : [])}
                    />
                  </th>
                  <th className="py-3">Product</th>
                  <th className="py-3">Seller</th>
                  <th className="py-3">Price</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Moderation</th>
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
                      <td className="py-3 pr-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked.includes(row.id)}
                          onChange={() => toggleChecked(row.id)}
                          aria-label={`Select ${row.title}`}
                        />
                      </td>
                      <td className="py-3">
                        <span className="flex items-center gap-2">
                          {row.thumbnail_url || row.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.thumbnail_url || row.photo_url || ""} alt="" className="h-10 w-10 rounded-lg object-cover" />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f4f8fd] text-[#8a94a6]">▢</span>
                          )}
                          <span>
                            <span className="block font-semibold text-[#0f1c3f]">{row.title}</span>
                            <span className="text-[12px] text-[#8a94a6]">
                              {row.category || row.format} · {row.quantity} in stock · {when(row.created_at)}
                              {row.is_featured ? " · featured" : ""}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="py-3 text-[#3a4a66]">{row.seller}</td>
                      <td className="py-3 font-semibold">
                        {row.format === "auction" || row.format === "both"
                          ? money(row.auction_current_price ?? row.price)
                          : row.price != null
                            ? money(row.price)
                            : "-"}
                      </td>
                      <td className="py-3">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="py-3">
                        <StatusPill status={row.moderation_status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length ? <Empty title="No products yet" sub="Listings appear here after sellers publish them." /> : null}
          </div>
        </section>

        <aside className="nexlo-card h-fit p-5 xl:sticky xl:top-24">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Selected listing</p>
                <h2 className="mt-1 text-[18px] font-extrabold text-[#0f1c3f]">{selected.title}</h2>
                <p className="text-[13px] text-[#6b7587]">{selected.seller}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill status={selected.status} />
                <StatusPill status={selected.moderation_status} />
              </div>
              <dl className="space-y-2 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8a94a6]">Format</dt>
                  <dd className="capitalize text-[#0f1c3f]">{selected.format}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8a94a6]">Category</dt>
                  <dd className="text-right text-[#0f1c3f]">{selected.category || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8a94a6]">Views</dt>
                  <dd className="text-[#0f1c3f]">{selected.view_count}</dd>
                </div>
                {selected.auction_ends_at ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#8a94a6]">Auction ends</dt>
                    <dd className="text-right text-[#0f1c3f]">{when(selected.auction_ends_at)}</dd>
                  </div>
                ) : null}
                {selected.moderation_reason ? (
                  <div>
                    <dt className="text-[#8a94a6]">Last reason</dt>
                    <dd className="mt-1 text-[#0f1c3f]">{selected.moderation_reason}</dd>
                  </div>
                ) : null}
              </dl>
              <div>
                <label className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Staff reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Required for reject / flag / force-end"
                  className="mt-1 w-full rounded-xl border border-[#e7eef6] px-3 py-2 text-[13px]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="nexlo-btn nexlo-btn-blue"
                  onClick={() => patch(selected.id, { moderationStatus: "approved", status: "active" }, "Listing approved.")}
                >
                  Approve & activate
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="nexlo-btn-ghost h-10"
                  onClick={() => patch(selected.id, { featured: !selected.is_featured }, selected.is_featured ? "Unfeatured." : "Featured.")}
                >
                  {selected.is_featured ? "Unfeature" : "Feature"}
                </button>
                {(selected.format === "auction" || selected.format === "both") && selected.status === "active" ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="h-10 rounded-full border border-[#f5c2c7] text-[13px] font-semibold text-[#e5484d]"
                    onClick={() => patch(selected.id, { forceEndAuction: true }, "Auction force-ended.")}
                  >
                    Force-end auction
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  className="h-10 rounded-full border border-[#f5c2c7] text-[13px] font-semibold text-[#e5484d]"
                  onClick={() =>
                    patch(selected.id, { moderationStatus: "rejected", status: "suspended" }, "Listing rejected.")
                  }
                >
                  Reject & suspend
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="h-10 rounded-full border border-[#e7eef6] text-[13px] font-semibold text-[#5b6780]"
                  onClick={() => patch(selected.id, { status: "removed" }, "Listing removed.")}
                >
                  Remove
                </button>
              </div>
              <Link href={`/listing/${selected.id}`} className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                View public listing →
              </Link>
            </div>
          ) : (
            <Empty title="Select a listing" sub="Click a row to approve, feature, reject, or force-end an auction." />
          )}
        </aside>
      </div>
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<p className="text-[14px] text-[#6b7587]">Loading products…</p>}>
      <ProductsBoard />
    </Suspense>
  );
}

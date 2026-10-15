"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";

type Collection = { public_id: string; name: string; item_count: number };
type Item = { id: number; title: string; price: number | null; primary_photo: string | null; status: string };

export function CollectionsBoard() {
  const [rows, setRows] = useState<Collection[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const body = await accountApi<{ data: Collection[] }>("/api/v1/account/collections");
    setRows(body.data || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load collections"));
  }, []);

  async function open(id: string) {
    setOpenId(id);
    const body = await accountApi<{ data: { items: Item[] } }>(`/api/v1/account/collections/${id}`);
    setItems(body.data.items || []);
  }

  return (
    <section className="nexlo-card p-6">
      <h1 className="text-[22px] font-extrabold text-[#0f1c3f]">Collections</h1>
      <p className="mt-1 text-[13px] text-[#667085]">Named lists, like My eBay collections. Watchlist stays separate.</p>
      {error ? <p className="mt-3 text-[13px] text-red-700">{error}</p> : null}
      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (name.trim().length < 2) return;
          await accountApi("/api/v1/account/collections", { method: "POST", body: JSON.stringify({ name }) });
          setName("");
          await load();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New collection name"
          className="h-10 min-w-[200px] flex-1 rounded-full border border-[#e2e8f0] px-4 text-[14px]"
        />
        <button className="h-10 rounded-full bg-[#3665f3] px-4 text-[13.5px] font-semibold text-white">Create</button>
      </form>
      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li key={row.public_id} className="rounded-xl border border-[#eef2f7] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="text-left font-semibold text-[#0f1c3f]" onClick={() => void open(row.public_id)}>
                {row.name} <span className="font-normal text-[#6b7587]">({row.item_count})</span>
              </button>
              <button
                type="button"
                className="text-[12.5px] text-[#e5484d]"
                onClick={async () => {
                  await accountApi(`/api/v1/account/collections/${row.public_id}`, { method: "DELETE" });
                  if (openId === row.public_id) {
                    setOpenId(null);
                    setItems([]);
                  }
                  await load();
                }}
              >
                Delete
              </button>
            </div>
            {openId === row.public_id ? (
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {items.map((item) => (
                  <li key={item.id} className="overflow-hidden rounded-lg border border-[#eef2f7]">
                    <Link href={`/listing/${item.id}`} className="block">
                      <span className="block aspect-square bg-[#f4f8fd]">
                        {item.primary_photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.primary_photo} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </span>
                      <span className="block truncate px-2 py-1.5 text-[12px]">{item.title}</span>
                    </Link>
                  </li>
                ))}
                {!items.length ? <li className="col-span-full text-[12.5px] text-[#8a94a6]">This collection is empty.</li> : null}
              </ul>
            ) : null}
          </li>
        ))}
        {!rows.length ? <li className="text-[13px] text-[#8a94a6]">No collections yet. Create one, then save items from a listing.</li> : null}
      </ul>
    </section>
  );
}

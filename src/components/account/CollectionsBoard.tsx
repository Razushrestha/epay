"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { AccountEmpty, AccountSection } from "@/components/account/AccountChrome";
import { money } from "@/components/commerce/BuyShell";

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
    <AccountSection
      title="Collections"
      body="Named lists, like My eBay collections. Watchlist stays separate."
      aside={
        <Link href="/watchlist" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
          Open watchlist →
        </Link>
      }
    >
      {error ? <p className="nexlo-alert nexlo-alert-error mb-4">{error}</p> : null}

      <form
        className="nexlo-card flex flex-wrap gap-2 p-4"
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
          className="nexlo-field min-w-[200px] flex-1"
        />
        <button type="submit" className="nexlo-btn nexlo-btn-blue h-10">
          Create
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="mt-4">
          <AccountEmpty
            title="No collections yet"
            body="Create a list, then save items from a listing page."
            action={
              <Link href="/search" className="nexlo-btn nexlo-btn-blue">
                Find items
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.public_id} className="nexlo-card p-4">
              <div className="flex items-center justify-between gap-3">
                <button type="button" className="text-left" onClick={() => void open(row.public_id)}>
                  <span className="text-[15px] font-bold text-[#0f1c3f]">{row.name}</span>
                  <span className="ml-2 text-[13px] text-[#6b7587]">
                    · {row.item_count} item{row.item_count === 1 ? "" : "s"}
                  </span>
                </button>
                <button
                  type="button"
                  className="text-[12.5px] font-semibold text-[#e5484d]"
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
                items.length === 0 ? (
                  <p className="mt-3 text-[13px] text-[#8a94a6]">This collection is empty.</p>
                ) : (
                  <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {items.map((item) => (
                      <li key={item.id}>
                        <Link href={`/listing/${item.id}`} className="block min-w-0">
                          <span className="block overflow-hidden rounded-2xl bg-[#f4f8fd]">
                            {item.primary_photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.primary_photo} alt="" className="aspect-[4/3] w-full object-cover" />
                            ) : (
                              <span className="flex aspect-[4/3] items-center justify-center text-[12px] text-[#6b7587]">No image</span>
                            )}
                          </span>
                          <span className="mt-1.5 line-clamp-2 block text-[13px] text-[#0f1c3f]">{item.title}</span>
                          {item.price != null ? (
                            <span className="text-[12px] font-semibold text-[#0f1c3f]">{money(item.price)}</span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AccountSection>
  );
}

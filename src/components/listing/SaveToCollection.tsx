"use client";

import { useEffect, useState } from "react";
import { accountApi, getToken } from "@/lib/account-api";

type Collection = { public_id: string; name: string };

export function SaveToCollection({ listingId }: { listingId: number }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Collection[]>([]);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    if (!getToken()) return;
    const body = await accountApi<{ data: Collection[] }>("/api/v1/account/collections");
    setRows(body.data || []);
  }

  useEffect(() => {
    if (open) load().catch(() => undefined);
  }, [open]);

  if (!getToken()) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#d7e0ec] text-[14px] font-semibold text-[#0f1c3f]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.2L6 20V5a1 1 0 0 1 1-1Z" />
        </svg>
        Save to collection
      </button>
      {open ? (
        <div className="mt-2 rounded-2xl border border-[#e7eef6] p-3">
          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.public_id}>
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-[#f3f7fc]"
                  onClick={async () => {
                    await accountApi(`/api/v1/account/collections/${row.public_id}/items`, {
                      method: "POST",
                      body: JSON.stringify({ listingId }),
                    });
                    setNotice(`Saved to ${row.name}.`);
                    setOpen(false);
                  }}
                >
                  {row.name}
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (name.trim().length < 2) return;
              const created = await accountApi<{ data: Collection }>("/api/v1/account/collections", {
                method: "POST",
                body: JSON.stringify({ name }),
              });
              await accountApi(`/api/v1/account/collections/${created.data.public_id}/items`, {
                method: "POST",
                body: JSON.stringify({ listingId }),
              });
              setName("");
              setNotice(`Saved to ${created.data.name}.`);
              setOpen(false);
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New list"
              className="h-9 min-w-0 flex-1 rounded-full border px-3 text-[13px]"
            />
            <button className="h-9 rounded-full bg-[#3665f3] px-3 text-[12.5px] font-semibold text-white">Add</button>
          </form>
        </div>
      ) : null}
      {notice ? <p className="mt-1 text-center text-[12px] text-[#12a37e]">{notice}</p> : null}
    </div>
  );
}

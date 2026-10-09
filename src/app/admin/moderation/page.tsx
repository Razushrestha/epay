"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, StatusPill } from "@/components/admin/admin-ui";

type Item = { id: number; public_id: string; item_type: string; item_id: string; reason: string | null; score: number; decision: string | null; created_at: string };

export default function AdminModerationPage() {
  const [rows, setRows] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setRows((await accountApi<{ data: Item[] }>("/api/v1/admin/moderation")).data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load queue"));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Moderation</h1>
        <p className="text-[14px] text-[#6b7587]">Flagged listings, reports, and prohibited content.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.public_id} className="flex flex-wrap items-center justify-between gap-3 nexlo-card px-4 py-3">
            <div>
              <p className="font-semibold text-[#0f1c3f]">{row.item_type} #{row.item_id}</p>
              <p className="text-[13px] text-[#6b7587]">{row.reason} · score {row.score}</p>
            </div>
            <div className="flex items-center gap-2">
              {row.decision ? <StatusPill status={row.decision} /> : ["approved", "rejected", "flagged"].map((decision) => (
                <button key={decision} type="button" className="h-8 rounded-full border px-3 text-[12px] capitalize" onClick={async () => {
                  await accountApi(`/api/v1/admin/moderation/${row.id}`, { method: "POST", body: JSON.stringify({ decision }) });
                  await load();
                }}>{decision}</button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {!rows.length ? <Empty title="Queue is clear" sub="Flagged listings and member reports will land here." /> : null}
    </div>
  );
}

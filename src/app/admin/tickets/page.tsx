"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, StatusPill } from "@/components/admin/admin-ui";

type Ticket = { id: number; public_id: string; subject: string; category: string; priority: string; status: string; email?: string; name?: string; created_at: string };

export default function AdminTicketsPage() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setRows((await accountApi<{ data: Ticket[] }>("/api/v1/admin/tickets")).data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load tickets"));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Support tickets</h1>
        <p className="text-[14px] text-[#6b7587]">Assign, reply, and close buyer or seller requests.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.public_id} className="nexlo-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-[#0f1c3f]">{row.subject}</p>
                <p className="text-[13px] text-[#6b7587]">{row.name || row.email} · {row.category} · {row.priority}</p>
              </div>
              <StatusPill status={row.status} />
            </div>
            <form className="mt-3 flex gap-2" onSubmit={async (e) => {
              e.preventDefault();
              await accountApi(`/api/v1/admin/tickets/${row.public_id}`, { method: "PATCH", body: JSON.stringify({ status: "resolved", body: reply || "Resolved by staff" }) });
              setReply("");
              await load();
            }}>
              <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply and resolve" className="h-9 flex-1 rounded-full border px-3 text-[13px]" />
              <button className="h-9 rounded-full bg-[#3665f3] px-4 text-[13px] text-white">Resolve</button>
            </form>
          </li>
        ))}
      </ul>
      {!rows.length ? <Empty title="No tickets" sub="New support requests will show up here." /> : null}
    </div>
  );
}

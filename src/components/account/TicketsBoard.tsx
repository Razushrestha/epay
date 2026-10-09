"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";

type Ticket = { id: number; public_id: string; subject: string; category: string; priority: string; status: string; created_at: string };

export function TicketsBoard() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [form, setForm] = useState({ subject: "", body: "", category: "general" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setRows((await accountApi<{ data: Ticket[] }>("/api/v1/tickets")).data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load tickets"));
  }, []);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-[22px] font-extrabold text-[#0f1c3f]">Support</h1>
        <p className="mt-1 text-[14px] text-[#6b7587]">Open a ticket for orders, payouts, or account issues. Staff reply from the admin desk.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-[#eaf1ff] px-4 py-3 text-[13px] text-[#2a4fa8]">{notice}</p> : null}
      <form
        className="nexlo-card space-y-2 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          await accountApi("/api/v1/tickets", { method: "POST", body: JSON.stringify(form) });
          setForm({ subject: "", body: "", category: "general" });
          setNotice("Ticket opened. We will reply here.");
          await load();
        }}
      >
        <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject" required className="h-10 w-full rounded-full border px-4" />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 rounded-full border px-3">
          <option value="general">General</option>
          <option value="order">Order</option>
          <option value="return">Return</option>
          <option value="payout">Payout</option>
          <option value="account">Account</option>
        </select>
        <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="min-h-24 w-full rounded-xl border px-3 py-2" placeholder="Describe the issue" />
        <button className="nexlo-btn nexlo-btn-blue">Submit ticket</button>
      </form>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.public_id} className="rounded-2xl bg-white px-4 py-3">
            <p className="font-semibold text-[#0f1c3f]">{row.subject}</p>
            <p className="text-[13px] capitalize text-[#6b7587]">{row.category} · {row.status} · {new Date(row.created_at).toLocaleString()}</p>
          </li>
        ))}
        {rows.length === 0 ? <li className="text-[13px] text-[#8a94a6]">No tickets yet.</li> : null}
      </ul>
    </section>
  );
}

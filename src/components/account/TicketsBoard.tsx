"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { AccountEmpty, AccountSection } from "@/components/account/AccountChrome";
import { StatusPill } from "@/components/commerce/BuyShell";

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
    <AccountSection
      title="Support"
      body="Open a ticket for orders, payouts, or account issues. Returns and cases live in the Resolution Center."
      aside={
        <Link href="/resolution" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
          Resolution Center →
        </Link>
      }
    >
      {error ? <p className="nexlo-alert nexlo-alert-error mb-4">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-ok mb-4">{notice}</p> : null}

      <form
        className="nexlo-card space-y-3 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          await accountApi("/api/v1/tickets", { method: "POST", body: JSON.stringify(form) });
          setForm({ subject: "", body: "", category: "general" });
          setNotice("Ticket opened. We will reply here.");
          await load();
        }}
      >
        <p className="text-[16px] font-bold text-[#0f1c3f]">New ticket</p>
        <input
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          placeholder="Subject"
          required
          className="nexlo-field"
        />
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="nexlo-field w-auto min-w-[180px]"
        >
          <option value="general">General</option>
          <option value="order">Order</option>
          <option value="return">Return</option>
          <option value="payout">Payout</option>
          <option value="account">Account</option>
        </select>
        <textarea
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          className="nexlo-field h-auto min-h-24 rounded-2xl py-3"
          placeholder="Describe the issue"
          required
        />
        <button type="submit" className="nexlo-btn nexlo-btn-blue">
          Submit ticket
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="mt-4">
          <AccountEmpty title="No tickets yet" body="When you submit a ticket, it will appear here with its status." />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li key={row.public_id} className="nexlo-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-[14px] font-bold text-[#0f1c3f]">{row.subject}</p>
                <p className="mt-0.5 text-[12.5px] capitalize text-[#6b7587]">
                  {row.category} · {new Date(row.created_at).toLocaleString()}
                </p>
              </div>
              <StatusPill status={row.status} />
            </li>
          ))}
        </ul>
      )}
    </AccountSection>
  );
}

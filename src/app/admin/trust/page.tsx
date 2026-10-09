"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";

type Trust = {
  events: { id: number; event_type: string; score: number; email?: string | null; created_at: string }[];
  blacklists: { id: number; kind: string; value: string; reason: string | null }[];
  strikes: { public_id: string; kind: string; reason: string; email: string; created_at: string }[];
  reports: { public_id: string; target_type: string; target_id: string; reason: string; status: string }[];
};

export default function AdminTrustPage() {
  const [data, setData] = useState<Trust | null>(null);
  const [form, setForm] = useState({ kind: "email", value: "", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setData(await accountApi<Trust>("/api/v1/admin/trust"));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load trust tools"));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Trust and safety</h1>
        <p className="text-[14px] text-[#6b7587]">Velocity checks, blacklists, strikes, and member reports.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-[#eaf1ff] px-4 py-3 text-[13px] text-[#2a4fa8]">{notice}</p> : null}
      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold">Add to blacklist</h2>
        <form className="mt-3 grid gap-2 sm:grid-cols-4" onSubmit={async (e) => {
          e.preventDefault();
          await accountApi("/api/v1/admin/trust/blacklist", { method: "POST", body: JSON.stringify(form) });
          setNotice("Blacklist updated.");
          setForm({ kind: "email", value: "", reason: "" });
          await load();
        }}>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="h-10 rounded-full border px-3">
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="ip">IP</option>
            <option value="device">Device</option>
          </select>
          <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="Value" className="h-10 rounded-full border px-4" />
          <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason" className="h-10 rounded-full border px-4" />
          <button className="h-10 rounded-full bg-[#121826] px-4 text-[13px] text-white">Block</button>
        </form>
      </section>
      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold">Risk events</h2>
        <ul className="mt-3 space-y-1 text-[13px]">
          {(data?.events || []).slice(0, 20).map((ev) => (
            <li key={ev.id}>{ev.event_type} · {ev.email || "unknown"} · +{ev.score}</li>
          ))}
          {!data?.events?.length ? <li className="text-[#8a94a6]">No risk events yet.</li> : null}
        </ul>
      </section>
      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold">Strikes</h2>
        <ul className="mt-3 space-y-1 text-[13px]">
          {(data?.strikes || []).map((s) => (
            <li key={s.public_id}>{s.email} · {s.kind} · {s.reason}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

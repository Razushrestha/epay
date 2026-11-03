"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, when } from "@/components/admin/admin-ui";

type Trust = {
  events: { id: number; event_type: string; score: number; email?: string | null; created_at: string }[];
  blacklists: { id: number; kind: string; value: string; reason: string | null; created_at?: string }[];
  strikes: { public_id: string; kind: string; reason: string; email: string; created_at: string }[];
  reports: { public_id: string; target_type: string; target_id: string; reason: string; status: string }[];
};

export default function AdminTrustPage() {
  const [data, setData] = useState<Trust | null>(null);
  const [form, setForm] = useState({ kind: "email", value: "", reason: "" });
  const [strike, setStrike] = useState({ userId: "", kind: "policy", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        <p className="text-[14px] text-[#6b7587]">Blacklists, strikes, risk events, and member reports — every write needs a reason.</p>
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="nexlo-card p-5">
          <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Add to blacklist</h2>
          <form
            className="mt-3 grid gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              if (form.reason.trim().length < 3) {
                setError("Blacklist reason must be at least 3 characters.");
                return;
              }
              setBusy(true);
              try {
                await accountApi("/api/v1/admin/trust/blacklist", { method: "POST", body: JSON.stringify(form) });
                setNotice(`Blocked ${form.kind}: ${form.value}`);
                setForm({ kind: "email", value: "", reason: "" });
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not update blacklist");
              } finally {
                setBusy(false);
              }
            }}
          >
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="nexlo-field">
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="ip">IP</option>
              <option value="device">Device</option>
            </select>
            <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="Value" required className="nexlo-field" />
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason (required)" required className="nexlo-field" />
            <button disabled={busy} className="nexlo-btn nexlo-btn-blue">
              Block
            </button>
          </form>
          <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto text-[13px]">
            {(data?.blacklists || []).map((row) => (
              <li key={row.id} className="rounded-xl bg-[#f8fbff] px-3 py-2">
                <p className="font-semibold text-[#0f1c3f]">
                  {row.kind}: {row.value}
                </p>
                <p className="text-[#6b7587]">{row.reason || "No reason"}</p>
              </li>
            ))}
            {!data?.blacklists?.length ? <li className="text-[#8a94a6]">No blacklist entries yet.</li> : null}
          </ul>
        </section>

        <section className="nexlo-card p-5">
          <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Issue strike</h2>
          <form
            className="mt-3 grid gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              if (strike.reason.trim().length < 3) {
                setError("Strike reason must be at least 3 characters.");
                return;
              }
              setBusy(true);
              try {
                await accountApi("/api/v1/admin/strikes", { method: "POST", body: JSON.stringify(strike) });
                setNotice("Strike recorded.");
                setStrike({ userId: "", kind: "policy", reason: "" });
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not create strike");
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              value={strike.userId}
              onChange={(e) => setStrike({ ...strike, userId: e.target.value })}
              placeholder="User public id or UUID"
              required
              className="nexlo-field"
            />
            <select value={strike.kind} onChange={(e) => setStrike({ ...strike, kind: e.target.value })} className="nexlo-field">
              <option value="policy">Policy</option>
              <option value="fraud">Fraud</option>
              <option value="abuse">Abuse</option>
              <option value="listing">Listing</option>
            </select>
            <input
              value={strike.reason}
              onChange={(e) => setStrike({ ...strike, reason: e.target.value })}
              placeholder="Reason (required)"
              required
              className="nexlo-field"
            />
            <button disabled={busy} className="nexlo-btn nexlo-btn-blue">
              Add strike
            </button>
          </form>
          <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto text-[13px]">
            {(data?.strikes || []).map((s) => (
              <li key={s.public_id} className="rounded-xl bg-[#fff5f5] px-3 py-2">
                <p className="font-semibold text-[#0f1c3f]">
                  {s.email} · {s.kind}
                </p>
                <p className="text-[#6b7587]">{s.reason}</p>
                <p className="text-[11px] text-[#8a94a6]">{when(s.created_at)}</p>
              </li>
            ))}
            {!data?.strikes?.length ? <li className="text-[#8a94a6]">No strikes yet.</li> : null}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="nexlo-card p-5">
          <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Risk events</h2>
          <ul className="mt-3 space-y-2 text-[13px]">
            {(data?.events || []).slice(0, 20).map((ev) => (
              <li key={ev.id} className="flex justify-between gap-3 border-b border-[#f3f6fa] py-2 last:border-0">
                <span>
                  <span className="font-semibold text-[#0f1c3f]">{ev.event_type}</span>
                  <span className="block text-[#6b7587]">{ev.email || "unknown"}</span>
                </span>
                <span className="font-semibold text-[#e5484d]">+{ev.score}</span>
              </li>
            ))}
            {!data?.events?.length ? <Empty title="No risk events" sub="Velocity and trust signals appear here." /> : null}
          </ul>
        </section>

        <section className="nexlo-card p-5">
          <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Member reports</h2>
          <ul className="mt-3 space-y-2 text-[13px]">
            {(data?.reports || []).slice(0, 20).map((r) => (
              <li key={r.public_id} className="rounded-xl bg-[#f8fbff] px-3 py-2">
                <p className="font-semibold text-[#0f1c3f]">
                  {r.target_type} · {r.status}
                </p>
                <p className="text-[#6b7587]">{r.reason}</p>
                <p className="font-mono text-[11px] text-[#8a94a6]">{r.target_id}</p>
              </li>
            ))}
            {!data?.reports?.length ? <li className="text-[#8a94a6]">No reports yet.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}

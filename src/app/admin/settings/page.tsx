"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";

type Kyc = { public_id: string; doc_type: string; status: string; email: string; display_name: string | null };
type Appeal = { public_id: string; message: string; email: string; display_name: string | null; created_at?: string };
type Settings = { siteName: string; currency: string; country: string; supportEmail: string; maintenance: boolean };

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>({ siteName: "Nexlo", currency: "NPR", country: "Nepal", supportEmail: "", maintenance: false });
  const [staff, setStaff] = useState<{ public_id: string; email: string; name: string }[]>([]);
  const [kyc, setKyc] = useState<Kyc[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [cfg, docs, notes] = await Promise.all([
      accountApi<{ settings: Settings; staff: { public_id: string; email: string; name: string }[] }>("/api/v1/admin/settings"),
      accountApi<{ data: Kyc[] }>("/api/v1/admin/kyc"),
      accountApi<{ data: Appeal[] }>("/api/v1/admin/appeals"),
    ]);
    setSettings(cfg.settings);
    setStaff(cfg.staff);
    setKyc(docs.data);
    setAppeals(notes.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load settings"));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Settings</h1>
        <p className="text-[14px] text-[#6b7587]">Platform details, identity reviews, and appeals.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-[#eaf1ff] px-4 py-3 text-[13px] text-[#2a4fa8]">{notice}</p> : null}

      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Platform</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await accountApi("/api/v1/admin/settings", { method: "PATCH", body: JSON.stringify(settings) });
            setNotice("Settings saved.");
          }}
        >
          <label className="text-[13px] text-[#5b6780]">Site name<input value={settings.siteName} onChange={(e) => setSettings({ ...settings, siteName: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#e2e8f0] px-3 text-[14px] text-[#0f1c3f]" /></label>
          <label className="text-[13px] text-[#5b6780]">Currency<input value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#e2e8f0] px-3 text-[14px] text-[#0f1c3f]" /></label>
          <label className="text-[13px] text-[#5b6780]">Country<input value={settings.country} onChange={(e) => setSettings({ ...settings, country: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#e2e8f0] px-3 text-[14px] text-[#0f1c3f]" /></label>
          <label className="text-[13px] text-[#5b6780]">Support email<input value={settings.supportEmail} onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#e2e8f0] px-3 text-[14px] text-[#0f1c3f]" /></label>
          <label className="flex items-center gap-2 text-[14px] text-[#3a4a66] sm:col-span-2">
            <input type="checkbox" checked={settings.maintenance} onChange={(e) => setSettings({ ...settings, maintenance: e.target.checked })} />
            Maintenance mode
          </label>
          <button className="h-10 rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white">Save settings</button>
        </form>
      </section>

      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Staff</h2>
        <ul className="mt-3 space-y-2 text-[14px]">
          {staff.map((person) => (
            <li key={person.public_id} className="flex justify-between rounded-xl bg-[#f7f7f7] px-3 py-2">
              <span className="font-medium text-[#0f1c3f]">{person.name}</span>
              <span className="text-[#6b7587]">{person.email}</span>
            </li>
          ))}
          {!staff.length ? <li className="text-[13px] text-[#8a94a6]">No staff accounts.</li> : null}
        </ul>
      </section>

      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Identity reviews</h2>
        <ul className="mt-3 space-y-2">
          {kyc.map((item) => (
            <li key={item.public_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#eef2f7] px-3 py-3 text-[13px]">
              <span>{item.display_name || item.email} · {item.doc_type} · {item.status}</span>
              {item.status === "pending" ? (
                <span className="flex gap-2">
                  <button type="button" className="text-[#12a37e]" onClick={() => accountApi(`/api/v1/admin/kyc/${item.public_id}`, { method: "POST", body: JSON.stringify({ decision: "approved" }) }).then(load)}>Approve</button>
                  <button type="button" className="text-[#e5484d]" onClick={() => {
                    const why = window.prompt("Reason for rejection") ?? "";
                    if (!why.trim()) return;
                    accountApi(`/api/v1/admin/kyc/${item.public_id}`, { method: "POST", body: JSON.stringify({ decision: "rejected", reason: why }) }).then(load);
                  }}>Reject</button>
                </span>
              ) : null}
            </li>
          ))}
          {!kyc.length ? <li className="text-[13px] text-[#8a94a6]">No documents yet.</li> : null}
        </ul>
      </section>

      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Appeals</h2>
        <ul className="mt-3 space-y-2">
          {appeals.map((item) => (
            <li key={item.public_id} className="rounded-xl border border-[#eef2f7] px-3 py-3 text-[13px]">
              <p>{item.display_name || item.email}: {item.message}</p>
              <span className="mt-2 flex gap-3">
                <button type="button" className="text-[#12a37e]" onClick={() => accountApi(`/api/v1/admin/appeals/${item.public_id}`, { method: "POST", body: JSON.stringify({ decision: "overturned", resolution: "Appeal accepted" }) }).then(load)}>Overturn</button>
                <button type="button" className="text-[#e5484d]" onClick={() => accountApi(`/api/v1/admin/appeals/${item.public_id}`, { method: "POST", body: JSON.stringify({ decision: "upheld", resolution: "Original action stands" }) }).then(load)}>Uphold</button>
              </span>
            </li>
          ))}
          {!appeals.length ? <li className="text-[13px] text-[#8a94a6]">No open appeals.</li> : null}
        </ul>
      </section>
    </div>
  );
}

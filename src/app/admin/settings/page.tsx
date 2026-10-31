"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { accountApi } from "@/lib/account-api";

type Kyc = {
  public_id: string;
  doc_type: string;
  status: string;
  email: string;
  display_name: string | null;
  files?: { front?: string; back?: string; selfie?: string };
};
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
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}

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
          <label className="text-[13px] text-[#5b6780]">Site name<input value={settings.siteName} onChange={(e) => setSettings({ ...settings, siteName: e.target.value })} className="nexlo-field mt-1" /></label>
          <label className="text-[13px] text-[#5b6780]">Currency<input value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="nexlo-field mt-1" /></label>
          <label className="text-[13px] text-[#5b6780]">Country<input value={settings.country} onChange={(e) => setSettings({ ...settings, country: e.target.value })} className="nexlo-field mt-1" /></label>
          <label className="text-[13px] text-[#5b6780]">Support email<input value={settings.supportEmail} onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })} className="nexlo-field mt-1" /></label>
          <label className="flex items-center gap-2 text-[14px] text-[#3a4a66] sm:col-span-2">
            <input type="checkbox" checked={settings.maintenance} onChange={(e) => setSettings({ ...settings, maintenance: e.target.checked })} />
            Maintenance mode
          </label>
          <button className="nexlo-btn nexlo-btn-blue">Save settings</button>
        </form>
      </section>

      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Staff</h2>
        <ul className="mt-3 space-y-2 text-[14px]">
          {staff.map((person) => (
            <li key={person.public_id} className="flex justify-between rounded-xl bg-[#f4f8fd] px-3 py-2">
              <span className="font-medium text-[#0f1c3f]">{person.name}</span>
              <span className="text-[#6b7587]">{person.email}</span>
            </li>
          ))}
          {!staff.length ? <li className="text-[13px] text-[#8a94a6]">No staff accounts.</li> : null}
        </ul>
      </section>

      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Identity reviews</h2>
        <p className="mt-2 text-[13px] text-[#6b7587]">{kyc.filter((item) => item.status === "pending").length} pending applications.</p>
        <Link href="/admin/kyc" className="mt-3 inline-block text-[13px] font-semibold text-[#3665f3] hover:underline">
          Open KYC review console →
        </Link>
      </section>

      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Appeals</h2>
        <p className="mt-2 text-[13px] text-[#6b7587]">{appeals.length} pending standing appeals.</p>
        <Link href="/admin/appeals" className="mt-3 inline-block text-[13px] font-semibold text-[#3665f3] hover:underline">
          Open appeals console →
        </Link>
      </section>
    </div>
  );
}

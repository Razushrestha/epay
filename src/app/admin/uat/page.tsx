"use client";

import { useCallback, useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";

type UatMeta = {
  goLive: { cdnConfigured: boolean; storageConfigured: boolean; apiP95TargetMs: number; searchP95TargetMs: number };
  counts: { activeListings: number; orders: number; returns: number; cases: number; tickets: number };
  commands: { load: string; uat: string };
  outOfFee: string[];
};

type Smoke = { name: string; url: string; pass: boolean; status: number; ms: number };

const SMOKE: { name: string; url: string; ok: (status: number) => boolean }[] = [
  { name: "Catalog", url: "/api/v1/catalog/categories?level=1", ok: (s) => s === 200 },
  { name: "Browse listings", url: "/api/v1/listings?limit=8", ok: (s) => s === 200 },
  { name: "Search", url: "/api/v1/listings/search?q=a&limit=8", ok: (s) => s === 200 },
  { name: "Deals", url: "/api/v1/listings/deals?limit=6", ok: (s) => s === 200 },
  { name: "Buyer Protection", url: "/buyer-protection", ok: (s) => s === 200 },
  { name: "Help", url: "/help", ok: (s) => s === 200 },
  { name: "Resolution Center", url: "/resolution", ok: (s) => s === 200 || s === 307 || s === 308 },
  { name: "Help BP redirect", url: "/help/buyer-protection", ok: (s) => s === 307 || s === 308 || s === 301 || s === 302 },
];

const MANUAL = [
  { id: "bp", label: "Branded Buyer Protection page is live at /buyer-protection" },
  { id: "rc", label: "Resolution Center unifies returns, cases, and tickets" },
  { id: "cdn", label: "CDN_PUBLIC_URL or NEXT_PUBLIC_CDN_URL is set in production" },
  { id: "load", label: "npm run test:load meets API p95 < 300ms and search p95 < 400ms" },
  { id: "uat", label: "npm run test:uat passes against staging or production" },
  { id: "escrow", label: "Pay → ship → received → escrow release → payout still works" },
  { id: "mail", label: "Auth codes and notifications send on production Mailgun" },
];

export default function AdminUatPage() {
  const [meta, setMeta] = useState<UatMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [smoke, setSmoke] = useState<Smoke[] | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    accountApi<UatMeta>("/api/v1/admin/uat")
      .then(setMeta)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load UAT status"));
    try {
      const saved = JSON.parse(localStorage.getItem("nexlo-uat-checks") || "{}") as Record<string, boolean>;
      setDone(saved);
    } catch {
      setDone({});
    }
  }, []);

  function toggle(id: string) {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem("nexlo-uat-checks", JSON.stringify(next));
      return next;
    });
  }

  const runSmoke = useCallback(async () => {
    setRunning(true);
    const results: Smoke[] = [];
    for (const check of SMOKE) {
      const started = Date.now();
      try {
        const res = await fetch(check.url, { redirect: "manual" });
        results.push({ name: check.name, url: check.url, pass: check.ok(res.status), status: res.status, ms: Date.now() - started });
      } catch {
        results.push({ name: check.name, url: check.url, pass: false, status: 0, ms: Date.now() - started });
      }
    }
    setSmoke(results);
    setRunning(false);
  }, []);

  const passed = smoke?.filter((r) => r.pass).length ?? 0;
  const failed = smoke?.filter((r) => !r.pass).length ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Go-live UAT</h1>
        <p className="text-[14px] text-[#6b7587]">
          Production smoke versus the §10.3 targets. Prepaid return labels, Authenticity Guarantee, VeRO, and Terapeak stay out of fee.
        </p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["CDN", meta?.goLive.cdnConfigured ? "Configured" : "Not set"],
          ["Storage", meta?.goLive.storageConfigured ? "Configured" : "Not set"],
          ["API p95", `${meta?.goLive.apiP95TargetMs ?? 300}ms`],
          ["Search p95", `${meta?.goLive.searchP95TargetMs ?? 400}ms`],
        ].map(([label, value]) => (
          <section key={String(label)} className="nexlo-card p-4">
            <p className="text-[13px] text-[#8a94a6]">{label}</p>
            <p className="mt-1 text-[18px] font-extrabold text-[#0f1c3f]">{value}</p>
          </section>
        ))}
      </div>

      <section className="nexlo-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Live smoke</h2>
            <p className="text-[13px] text-[#6b7587]">Hits this origin. Also run <code className="rounded bg-[#f3f6fb] px-1.5">{meta?.commands.uat || "npm run test:uat"}</code> and <code className="rounded bg-[#f3f6fb] px-1.5">{meta?.commands.load || "npm run test:load"}</code>.</p>
          </div>
          <button type="button" onClick={runSmoke} disabled={running} className="h-10 rounded-full bg-[#3665f3] px-5 text-[13px] font-semibold text-white disabled:opacity-60">
            {running ? "Running…" : "Run smoke"}
          </button>
        </div>
        {smoke ? (
          <ul className="mt-4 space-y-1 text-[13px]">
            {smoke.map((row) => (
              <li key={row.name} className={row.pass ? "text-[#12a37e]" : "text-[#e53238]"}>
                {row.pass ? "Pass" : "Fail"} · {row.name} · {row.status} · {row.ms}ms
              </li>
            ))}
            <li className="pt-1 font-semibold text-[#0f1c3f]">{passed} passed · {failed} failed</li>
          </ul>
        ) : (
          <p className="mt-3 text-[13px] text-[#8a94a6]">No run yet this session.</p>
        )}
      </section>

      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Checklist</h2>
        <ul className="mt-3 space-y-2">
          {MANUAL.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-start gap-2 text-[14px] text-[#0f1c3f]">
                <input type="checkbox" checked={Boolean(done[item.id])} onChange={() => toggle(item.id)} className="mt-1" />
                {item.label}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Live counts</h2>
        <p className="mt-2 text-[13px] text-[#6b7587]">
          {meta
            ? `${meta.counts.activeListings} active listings · ${meta.counts.orders} orders · ${meta.counts.returns} returns · ${meta.counts.cases} cases · ${meta.counts.tickets} tickets`
            : "Loading…"}
        </p>
        <p className="mt-3 text-[12px] text-[#8a94a6]">Out of fee: {(meta?.outOfFee || []).join(", ")}.</p>
      </section>
    </div>
  );
}

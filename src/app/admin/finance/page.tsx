"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { money } from "@/components/admin/admin-ui";

type Finance = {
  gmv: { gmv: number; orders: number };
  fees: { fees: number };
  payouts: { status: string; amount: number; c: number }[];
  refunds: { refunds: number };
  ledger: { debit: number; credit: number };
};

export default function AdminFinancePage() {
  const [data, setData] = useState<Finance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accountApi<Finance>("/api/v1/admin/finance")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load finance"));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Finance</h1>
        <p className="text-[14px] text-[#6b7587]">GMV, fees, refunds, payouts, and ledger balance.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["GMV", money(data?.gmv.gmv ?? 0)],
          ["Orders", data?.gmv.orders ?? 0],
          ["Fees", money(data?.fees.fees ?? 0)],
          ["Refunds", money(data?.refunds.refunds ?? 0)],
        ].map(([label, value]) => (
          <section key={String(label)} className="nexlo-card p-4">
            <p className="text-[13px] text-[#8a94a6]">{label}</p>
            <p className="mt-1 text-[22px] font-extrabold text-[#0f1c3f]">{value}</p>
          </section>
        ))}
      </div>
      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold">Ledger</h2>
        <p className="mt-2 text-[14px] text-[#5b6780]">Debit {money(data?.ledger.debit ?? 0)} · Credit {money(data?.ledger.credit ?? 0)}</p>
        <ul className="mt-3 text-[13px]">
          {(data?.payouts || []).map((p) => (
            <li key={p.status}>{p.status}: {money(p.amount)} ({p.c})</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";

type Wallet = {
  wallet: { available_balance: number; pending_balance: number; lifetime_earnings: number } | null;
  accounts: { id: number; method: string; label: string | null; is_default: boolean }[];
  payouts: { public_id: string; amount: number; method: string; status: string; created_at: string; admin_note: string | null }[];
  invoices: { order_number: string; commission: number; net_to_seller: number; created_at: string }[];
};

const money = (n: number) => `NPR ${Number(n || 0).toLocaleString("en-NP")}`;

export function SellerWallet() {
  const [data, setData] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState("1000");
  const [method, setMethod] = useState("esewa");
  const [label, setLabel] = useState("");
  const [details, setDetails] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setData(await accountApi<Wallet>("/api/v1/wallet"));
  }

  useEffect(() => {
    load().catch((err) => setNotice(err instanceof Error ? err.message : "Could not load wallet"));
  }, []);

  if (!data) return <p className="text-[14px] text-[#6b7587]">Loading wallet…</p>;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Available", money(data.wallet?.available_balance ?? 0)],
          ["In escrow", money(data.wallet?.pending_balance ?? 0)],
          ["Lifetime", money(data.wallet?.lifetime_earnings ?? 0)],
        ].map(([labelText, value]) => (
          <div key={labelText} className="rounded-2xl bg-[#f7f7f7] p-4">
            <p className="text-[12px] text-[#7a8496]">{labelText}</p>
            <p className="mt-1 text-[18px] font-extrabold text-[#0f1c3f]">{value}</p>
          </div>
        ))}
      </div>
      {notice ? <p className="text-[13px] text-[#3665f3]">{notice}</p> : null}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await accountApi("/api/v1/wallet/payouts", { method: "POST", body: JSON.stringify({ amount: Number(amount) }) });
          setNotice("Payout requested. Staff will approve it.");
          await load();
        }}
      >
        <input value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 w-32 rounded-full border px-4" />
        <button className="h-10 rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white">Request payout</button>
        <p className="self-center text-[12px] text-[#8a94a6]">Minimum NPR 1,000</p>
      </form>

      <form
        className="grid gap-2 sm:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await accountApi("/api/v1/wallet/accounts", {
            method: "POST",
            body: JSON.stringify({ method, label, details: { value: details }, isDefault: true }),
          });
          setNotice("Payout account saved.");
          await load();
        }}
      >
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-10 rounded-full border px-3">
          <option value="esewa">eSewa</option>
          <option value="khalti">Khalti</option>
          <option value="bank">Bank</option>
        </select>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="h-10 rounded-full border px-4" />
        <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Account / wallet ID" className="h-10 rounded-full border px-4" />
        <button className="h-10 rounded-full border px-4 text-[14px]">Save account</button>
      </form>

      <div>
        <h3 className="text-[15px] font-bold text-[#0f1c3f]">Payouts</h3>
        <ul className="mt-2 space-y-2 text-[13px]">
          {data.payouts.map((p) => (
            <li key={p.public_id} className="rounded-xl border px-3 py-2">
              {money(p.amount)} · {p.method} · {p.status}
            </li>
          ))}
          {data.payouts.length === 0 ? <li className="text-[#8a94a6]">No payouts yet.</li> : null}
        </ul>
      </div>

      <div>
        <h3 className="text-[15px] font-bold text-[#0f1c3f]">Fee invoices</h3>
        <ul className="mt-2 space-y-2 text-[13px]">
          {data.invoices.map((inv) => (
            <li key={inv.order_number} className="rounded-xl border px-3 py-2">
              {inv.order_number} · net {money(inv.net_to_seller)} · fee {money(inv.commission)}
            </li>
          ))}
          {data.invoices.length === 0 ? <li className="text-[#8a94a6]">Invoices appear after escrow is released.</li> : null}
        </ul>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, money } from "@/components/admin/admin-ui";

type Finance = {
  gmv: { gmv: number; orders: number };
  fees: { fees: number };
  payouts: { status: string; amount: number; c: number }[];
  refunds: { refunds: number };
  ledger: { debit: number; credit: number };
};

type Ledger = { debit: number; credit: number; balanced: boolean };
type Recon = {
  paymentTotal: number;
  ledgerCash: number;
  unmatched: number;
  balanced: boolean;
  payments?: { gateway: string; total: string | number; paid: number }[];
};

const LARGE_REFUND = 5000;

export default function AdminFinancePage() {
  const [data, setData] = useState<Finance | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [recon, setRecon] = useState<Recon | null>(null);
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [finance, integrity] = await Promise.all([
      accountApi<Finance>("/api/v1/admin/finance"),
      accountApi<{ data: Ledger; recon?: Recon }>("/api/v1/admin/ledger").catch(() => null),
    ]);
    setData(finance);
    if (integrity?.data) setLedger(integrity.data);
    if (integrity?.recon) setRecon(integrity.recon);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load finance"));
  }, []);

  const refundPreview = amount.trim() ? Number(amount) : null;
  const needsDualControl = refundPreview != null ? refundPreview >= LARGE_REFUND : true;

  async function issueRefund(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (reason.trim().length < 3) {
      setError("Refund reason is required (min 3 characters).");
      return;
    }
    const id = Number(orderId);
    if (!Number.isFinite(id) || id <= 0) {
      setError("Enter a numeric order id (internal id from Orders).");
      return;
    }
    if (needsDualControl && confirmPhrase.trim().toUpperCase() !== "REFUND") {
      setError(`Refunds of NPR ${LARGE_REFUND}+ (or unknown amount) require typing REFUND.`);
      return;
    }
    setBusy(true);
    try {
      const body = await accountApi<{ data: { refunded: number } }>("/api/v1/admin/refunds", {
        method: "POST",
        body: JSON.stringify({
          orderId: id,
          amount: amount.trim() ? Number(amount) : undefined,
          reason: reason.trim(),
          confirmPhrase: confirmPhrase.trim() || undefined,
        }),
      });
      setNotice(`Refunded ${money(body.data.refunded)} on order ${id}.`);
      setAmount("");
      setReason("");
      setConfirmPhrase("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not issue refund");
    } finally {
      setBusy(false);
    }
  }

  const balanced =
    ledger?.balanced ??
    (data ? Math.abs(Number(data.ledger.debit) - Number(data.ledger.credit)) < 0.01 : null);

  const riskFlags = [
    balanced === false ? "Ledger imbalance" : null,
    recon && !recon.balanced ? "Gateway cash mismatch" : null,
    recon && recon.unmatched > 0 ? `${recon.unmatched} unmatched payments` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Finance</h1>
        <p className="text-[14px] text-[#6b7587]">
          GMV, fees, refunds, payouts, and ledger balance. Large refunds need a typed REFUND confirm.
        </p>
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}
      {riskFlags.length ? (
        <p className="nexlo-alert nexlo-alert-error">Risk · {riskFlags.join(" · ")}</p>
      ) : balanced !== null ? (
        <p className="nexlo-alert nexlo-alert-info">
          Ledger balanced · debit {money(ledger?.debit ?? data?.ledger.debit ?? 0)} · credit{" "}
          {money(ledger?.credit ?? data?.ledger.credit ?? 0)}
          {recon ? ` · gateway cash ${money(recon.ledgerCash)} vs payments ${money(recon.paymentTotal)}` : ""}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="nexlo-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Payout snapshot</h2>
              <Link href="/admin/payouts" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                Open payouts →
              </Link>
            </div>
            {(data?.payouts || []).length ? (
              <ul className="mt-3 divide-y divide-[#eef2f7]">
                {(data?.payouts || []).map((p) => (
                  <li key={p.status} className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]">
                    <span className="capitalize text-[#5b6780]">{p.status}</span>
                    <span className="font-semibold text-[#0f1c3f]">
                      {money(p.amount)} <span className="font-normal text-[#8a94a6]">({p.c})</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No payout rows yet" sub="Seller withdrawals will aggregate here by status." />
            )}
          </section>

          <section className="nexlo-card p-5">
            <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Gateway recon</h2>
            {recon ? (
              <div className="mt-3 space-y-2 text-[13.5px]">
                <p className={recon.balanced ? "text-[#12a37e]" : "text-[#e5484d]"}>
                  {recon.balanced ? "Payments ≈ platform cash" : "Mismatch vs PLATFORM_CASH"}
                </p>
                <p className="text-[#5b6780]">
                  Payments {money(recon.paymentTotal)} · ledger cash {money(recon.ledgerCash)} · unmatched {recon.unmatched}
                </p>
                <ul className="divide-y divide-[#eef2f7]">
                  {(recon.payments || []).map((g) => (
                    <li key={g.gateway} className="flex justify-between py-2">
                      <span className="capitalize text-[#5b6780]">{g.gateway}</span>
                      <span className="font-semibold text-[#0f1c3f]">
                        {money(g.total)} <span className="font-normal text-[#8a94a6]">({g.paid} paid)</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-[#8a94a6]">Recon loads with ledger access.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-[13px]">
              <Link href="/admin/orders" className="font-semibold text-[#3665f3] hover:underline">
                Orders desk →
              </Link>
              <Link href="/admin/disputes" className="font-semibold text-[#3665f3] hover:underline">
                Disputes →
              </Link>
            </div>
          </section>
        </div>

        <aside className="nexlo-card h-fit p-5">
          <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Issue refund</h2>
          <p className="mt-1 text-[13px] text-[#6b7587]">
            Posts ledger entries and marks the order refunded. Dual-control: type REFUND when amount ≥ NPR {LARGE_REFUND}.
          </p>
          <form className="mt-4 space-y-3" onSubmit={issueRefund}>
            <div>
              <label className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Order id</label>
              <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="e.g. 42" className="mt-1 nexlo-field" required />
            </div>
            <div>
              <label className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Amount (optional)</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Full order if blank"
                type="number"
                min="0"
                step="0.01"
                className="mt-1 nexlo-field"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Required — shown to buyer & audit log"
                className="mt-1 w-full rounded-xl border border-[#e7eef6] px-3 py-2 text-[13px]"
                required
              />
            </div>
            {needsDualControl ? (
              <div>
                <label className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Confirm phrase</label>
                <input
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder="Type REFUND"
                  className="mt-1 nexlo-field"
                  autoComplete="off"
                />
              </div>
            ) : null}
            <button type="submit" disabled={busy} className="nexlo-btn nexlo-btn-blue w-full">
              {busy ? "Refunding…" : "Refund order"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

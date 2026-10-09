"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";

type ReturnRow = {
  id: number;
  public_id: string;
  order_number: string;
  item_title?: string | null;
  reason: string;
  status: string;
  amount: number;
  buyer_id: number;
  seller_id: number;
  requested_at: string;
};

type CaseRow = { id: number; public_id: string; order_number: string; case_type: string; status: string; amount_claimed: number };
type CaseDetail = { case: CaseRow; messages: { id: number; role: string; body: string; created_at: string }[]; evidence: { id: number; file_url: string }[] };

export function ReturnsBoard({ userId }: { userId?: string }) {
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [openCase, setOpenCase] = useState<CaseDetail | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  async function load() {
    const [r, c] = await Promise.all([
      accountApi<{ data: ReturnRow[]; protectionDays?: number }>("/api/v1/returns"),
      accountApi<{ data: CaseRow[] }>("/api/v1/cases"),
    ]);
    setReturns(r.data);
    setCases(c.data);
    if (r.protectionDays) setDays(r.protectionDays);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load returns"));
  }, []);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-[22px] font-extrabold text-[#0f1c3f]">Returns and cases</h1>
        <p className="mt-1 text-[14px] text-[#6b7587]">Buyer protection lasts {days} days after delivery. Open a return from the order page.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      <ul className="space-y-2">
        {returns.map((row) => (
          <li key={row.public_id} className="nexlo-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-[#0f1c3f]">{row.item_title || row.order_number}</p>
                <p className="text-[13px] capitalize text-[#6b7587]">{row.reason.replace(/_/g, " ")} · {row.status.replace(/_/g, " ")}</p>
              </div>
              <div className="flex gap-2">
                {row.status === "requested" ? (
                  <button type="button" className="h-9 rounded-full bg-[#12a37e] px-4 text-[13px] text-white" onClick={async () => {
                    await accountApi(`/api/v1/returns/${row.public_id}/decide`, { method: "POST", body: JSON.stringify({ approve: true }) });
                    await load();
                  }}>Approve return</button>
                ) : null}
                {row.status === "label_issued" ? (
                  <button type="button" className="h-9 rounded-full border px-4 text-[13px]" onClick={async () => {
                    await accountApi(`/api/v1/returns/${row.public_id}/ship`, { method: "POST", body: "{}" });
                    await load();
                  }}>Mark shipped back</button>
                ) : null}
                {row.status === "in_transit" ? (
                  <button type="button" className="h-9 rounded-full bg-[#3665f3] px-4 text-[13px] text-white" onClick={async () => {
                    await accountApi(`/api/v1/returns/${row.public_id}/receive`, { method: "POST", body: "{}" });
                    await load();
                  }}>Received — refund</button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
        {returns.length === 0 ? <li className="text-[14px] text-[#8a94a6]">No returns yet. <Link className="text-[#3665f3]" href="/orders">View orders</Link></li> : null}
      </ul>
      <h2 className="text-[16px] font-bold text-[#0f1c3f]">Cases</h2>
      <ul className="space-y-2">
        {cases.map((row) => (
          <li key={row.public_id}>
            <button type="button" className="w-full rounded-2xl bg-white px-4 py-3 text-left text-[14px]" onClick={async () => {
              setOpenCase(await accountApi<CaseDetail>(`/api/v1/cases/${row.public_id}`));
            }}>
              <span className="font-semibold uppercase">{row.case_type}</span> on {row.order_number} · {row.status.replace(/_/g, " ")}
            </button>
          </li>
        ))}
        {cases.length === 0 ? <li className="text-[13px] text-[#8a94a6]">No open cases.</li> : null}
      </ul>
      {openCase ? (
        <section className="nexlo-card p-5">
          <h3 className="font-extrabold text-[#0f1c3f]">{openCase.case.order_number} · {openCase.case.status.replace(/_/g, " ")}</h3>
          <ul className="mt-3 space-y-2 text-[13px]">
            {openCase.messages.map((m) => (
              <li key={m.id} className="rounded-xl bg-[#f7f7f7] px-3 py-2"><strong className="capitalize">{m.role}:</strong> {m.body}</li>
            ))}
          </ul>
          <form className="mt-3 flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            await accountApi(`/api/v1/cases/${openCase.case.public_id}/messages`, { method: "POST", body: JSON.stringify({ body: message }) });
            setMessage("");
            setOpenCase(await accountApi<CaseDetail>(`/api/v1/cases/${openCase.case.public_id}`));
          }}>
            <input value={message} onChange={(e) => setMessage(e.target.value)} className="h-10 flex-1 rounded-full border px-4" placeholder="Add evidence or a reply" />
            <button className="nexlo-btn nexlo-btn-blue h-10">Send</button>
          </form>
          {openCase.case.status === "resolved" ? (
            <button type="button" className="mt-3 h-9 rounded-full border px-4 text-[13px]" onClick={async () => {
              await accountApi(`/api/v1/cases/${openCase.case.public_id}/appeal`, { method: "POST", body: JSON.stringify({ message: "I appeal this decision" }) });
              await load();
            }}>Appeal once</button>
          ) : null}
        </section>
      ) : null}
      {userId ? null : null}
    </section>
  );
}

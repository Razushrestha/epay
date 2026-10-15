"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";

type ReturnRow = {
  public_id: string;
  order_number: string;
  item_title?: string | null;
  reason: string;
  status: string;
};

type CaseRow = { public_id: string; order_number: string; case_type: string; status: string };
type CaseDetail = { case: CaseRow; messages: { id: number; role: string; body: string; created_at: string }[] };
type Ticket = { public_id: string; subject: string; category: string; status: string; created_at: string };
type Pane = "returns" | "cases" | "tickets";

export function ResolutionCenter({ compact = false }: { compact?: boolean }) {
  const [pane, setPane] = useState<Pane>("returns");
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [openCase, setOpenCase] = useState<CaseDetail | null>(null);
  const [message, setMessage] = useState("");
  const [ticketForm, setTicketForm] = useState({ subject: "", body: "", category: "return" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  async function load() {
    const [r, c, t] = await Promise.all([
      accountApi<{ data: ReturnRow[]; protectionDays?: number }>("/api/v1/returns"),
      accountApi<{ data: CaseRow[] }>("/api/v1/cases"),
      accountApi<{ data: Ticket[] }>("/api/v1/tickets"),
    ]);
    setReturns(r.data);
    setCases(c.data);
    setTickets(t.data);
    if (r.protectionDays) setDays(r.protectionDays);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load Resolution Center"));
  }, []);

  const panes: { id: Pane; label: string; count: number }[] = [
    { id: "returns", label: "Returns", count: returns.length },
    { id: "cases", label: "Cases", count: cases.length },
    { id: "tickets", label: "Support tickets", count: tickets.length },
  ];

  return (
    <section className="space-y-4">
      {compact ? (
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0f1c3f]">Resolution Center</h1>
          <p className="mt-1 text-[14px] text-[#6b7587]">Returns, cases, and tickets. Buyer protection lasts {days} days after delivery.</p>
          <Link href="/resolution" className="mt-2 inline-block text-[13px] font-semibold text-[#3665f3]">Open full Resolution Center</Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-[14px] text-[#6b7587]">
            Buyer protection lasts {days} days after delivery.
          </p>
          <Link href="/orders" className="h-10 rounded-full bg-[#3665f3] px-5 text-[13px] font-semibold leading-10 text-white">
            File from an order
          </Link>
        </div>
      )}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-[#eaf1ff] px-4 py-3 text-[13px] text-[#2a4fa8]">{notice}</p> : null}
      <div className="flex gap-2 overflow-x-auto border-b border-[#e8eef5] pb-px">
        {panes.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPane(item.id)}
            className={`h-10 shrink-0 px-3 text-[13px] font-semibold ${pane === item.id ? "border-b-2 border-[#3665f3] text-[#3665f3]" : "text-[#5b6780]"}`}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      {pane === "returns" ? (
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
                    }}>Received and refund</button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
          {returns.length === 0 ? <li className="text-[14px] text-[#8a94a6]">No returns yet. <Link className="text-[#3665f3]" href="/orders">Open an order</Link> to file one.</li> : null}
        </ul>
      ) : null}

      {pane === "cases" ? (
        <>
          <ul className="space-y-2">
            {cases.map((row) => (
              <li key={row.public_id}>
                <button type="button" className="w-full rounded-2xl border border-[#e7eef6] bg-white px-4 py-3 text-left text-[14px]" onClick={async () => {
                  setOpenCase(await accountApi<CaseDetail>(`/api/v1/cases/${row.public_id}`));
                }}>
                  <span className="font-semibold uppercase">{row.case_type}</span> on {row.order_number} · {row.status.replace(/_/g, " ")}
                </button>
              </li>
            ))}
            {cases.length === 0 ? <li className="text-[13px] text-[#8a94a6]">No cases. A return that the seller declines or ignores becomes a case.</li> : null}
          </ul>
          {openCase ? (
            <section className="nexlo-card p-5">
              <h3 className="font-extrabold text-[#0f1c3f]">{openCase.case.order_number} · {openCase.case.status.replace(/_/g, " ")}</h3>
              <ul className="mt-3 space-y-2 text-[13px]">
                {openCase.messages.map((m) => (
                  <li key={m.id} className="rounded-xl bg-[#f4f8fd] px-3 py-2"><strong className="capitalize">{m.role}:</strong> {m.body}</li>
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
        </>
      ) : null}

      {pane === "tickets" ? (
        <>
          <form
            className="nexlo-card space-y-2 p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              await accountApi("/api/v1/tickets", { method: "POST", body: JSON.stringify(ticketForm) });
              setTicketForm({ subject: "", body: "", category: "return" });
              setNotice("Ticket opened. Staff reply from the admin desk.");
              await load();
            }}
          >
            <input value={ticketForm.subject} onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })} placeholder="Subject" required className="h-10 w-full rounded-full border px-4" />
            <select value={ticketForm.category} onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })} className="h-10 rounded-full border px-3">
              <option value="return">Return</option>
              <option value="order">Order</option>
              <option value="payout">Payout</option>
              <option value="account">Account</option>
              <option value="general">General</option>
            </select>
            <textarea value={ticketForm.body} onChange={(e) => setTicketForm({ ...ticketForm, body: e.target.value })} className="min-h-24 w-full rounded-xl border px-3 py-2" placeholder="Describe the issue" />
            <button className="nexlo-btn nexlo-btn-blue">Submit ticket</button>
          </form>
          <ul className="space-y-2">
            {tickets.map((row) => (
              <li key={row.public_id} className="rounded-2xl border border-[#e7eef6] bg-white px-4 py-3">
                <p className="font-semibold text-[#0f1c3f]">{row.subject}</p>
                <p className="text-[13px] capitalize text-[#6b7587]">{row.category} · {row.status} · {new Date(row.created_at).toLocaleString()}</p>
              </li>
            ))}
            {tickets.length === 0 ? <li className="text-[13px] text-[#8a94a6]">No tickets yet.</li> : null}
          </ul>
        </>
      ) : null}
    </section>
  );
}

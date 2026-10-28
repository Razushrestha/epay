"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { AccountEmpty, AccountSection } from "@/components/account/AccountChrome";
import { StatusPill } from "@/components/commerce/BuyShell";

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

  const body = (
    <section className="space-y-4">
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-ok">{notice}</p> : null}
      {!compact ? (
        <p className="text-[13px] text-[#6b7587]">Buyer protection lasts {days} days after delivery.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {panes.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPane(item.id)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold ${
              pane === item.id ? "bg-[#3665f3] text-white" : "border border-[#e7eef6] bg-white text-[#3a4a66]"
            }`}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      {pane === "returns" ? (
        returns.length === 0 ? (
          <AccountEmpty
            title="No returns yet"
            body="Open an order to file a return under Buyer Protection."
            action={
              <Link href="/orders" className="nexlo-btn nexlo-btn-blue">
                Your orders
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {returns.map((row) => (
              <li key={row.public_id} className="nexlo-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-bold text-[#0f1c3f]">{row.item_title || row.order_number}</p>
                    <p className="mt-0.5 text-[12.5px] capitalize text-[#6b7587]">{row.reason.replace(/_/g, " ")}</p>
                  </div>
                  <StatusPill status={row.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.status === "requested" ? (
                    <button
                      type="button"
                      className="h-9 rounded-full bg-[#12a37e] px-4 text-[13px] font-semibold text-white"
                      onClick={async () => {
                        await accountApi(`/api/v1/returns/${row.public_id}/decide`, { method: "POST", body: JSON.stringify({ approve: true }) });
                        await load();
                      }}
                    >
                      Approve return
                    </button>
                  ) : null}
                  {row.status === "label_issued" ? (
                    <button
                      type="button"
                      className="nexlo-btn-ghost h-9 px-4"
                      onClick={async () => {
                        await accountApi(`/api/v1/returns/${row.public_id}/ship`, { method: "POST", body: "{}" });
                        await load();
                      }}
                    >
                      Mark shipped back
                    </button>
                  ) : null}
                  {row.status === "in_transit" ? (
                    <button
                      type="button"
                      className="nexlo-btn nexlo-btn-blue h-9"
                      onClick={async () => {
                        await accountApi(`/api/v1/returns/${row.public_id}/receive`, { method: "POST", body: "{}" });
                        await load();
                      }}
                    >
                      Received and refund
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {pane === "cases" ? (
        <>
          {cases.length === 0 ? (
            <AccountEmpty
              title="No cases"
              body="A return that the seller declines or ignores becomes a case."
            />
          ) : (
            <ul className="space-y-2">
              {cases.map((row) => (
                <li key={row.public_id}>
                  <button
                    type="button"
                    className="nexlo-card flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left"
                    onClick={async () => {
                      setOpenCase(await accountApi<CaseDetail>(`/api/v1/cases/${row.public_id}`));
                    }}
                  >
                    <span>
                      <span className="text-[14px] font-bold uppercase text-[#0f1c3f]">{row.case_type}</span>
                      <span className="mt-0.5 block text-[12.5px] text-[#6b7587]">Order {row.order_number}</span>
                    </span>
                    <StatusPill status={row.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {openCase ? (
            <section className="nexlo-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[15px] font-bold text-[#0f1c3f]">{openCase.case.order_number}</h3>
                <StatusPill status={openCase.case.status} />
              </div>
              <ul className="mt-3 space-y-2">
                {openCase.messages.map((m) => (
                  <li key={m.id} className="rounded-2xl bg-[#f4f8fd] px-3 py-2 text-[13px]">
                    <strong className="capitalize">{m.role}:</strong> {m.body}
                  </li>
                ))}
              </ul>
              <form
                className="mt-3 flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await accountApi(`/api/v1/cases/${openCase.case.public_id}/messages`, { method: "POST", body: JSON.stringify({ body: message }) });
                  setMessage("");
                  setOpenCase(await accountApi<CaseDetail>(`/api/v1/cases/${openCase.case.public_id}`));
                }}
              >
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="nexlo-field flex-1"
                  placeholder="Add evidence or a reply"
                />
                <button type="submit" className="nexlo-btn nexlo-btn-blue h-10">
                  Send
                </button>
              </form>
              {openCase.case.status === "resolved" ? (
                <button
                  type="button"
                  className="nexlo-btn-ghost mt-3 h-9 px-4"
                  onClick={async () => {
                    await accountApi(`/api/v1/cases/${openCase.case.public_id}/appeal`, { method: "POST", body: JSON.stringify({ message: "I appeal this decision" }) });
                    await load();
                  }}
                >
                  Appeal once
                </button>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}

      {pane === "tickets" ? (
        <>
          <form
            className="nexlo-card space-y-3 p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              await accountApi("/api/v1/tickets", { method: "POST", body: JSON.stringify(ticketForm) });
              setTicketForm({ subject: "", body: "", category: "return" });
              setNotice("Ticket opened. Staff reply from the admin desk.");
              await load();
            }}
          >
            <p className="text-[16px] font-bold text-[#0f1c3f]">New ticket</p>
            <input
              value={ticketForm.subject}
              onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
              placeholder="Subject"
              required
              className="nexlo-field"
            />
            <select
              value={ticketForm.category}
              onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
              className="nexlo-field w-auto min-w-[180px]"
            >
              <option value="return">Return</option>
              <option value="order">Order</option>
              <option value="payout">Payout</option>
              <option value="account">Account</option>
              <option value="general">General</option>
            </select>
            <textarea
              value={ticketForm.body}
              onChange={(e) => setTicketForm({ ...ticketForm, body: e.target.value })}
              className="nexlo-field h-auto min-h-24 rounded-2xl py-3"
              placeholder="Describe the issue"
            />
            <button type="submit" className="nexlo-btn nexlo-btn-blue">
              Submit ticket
            </button>
          </form>
          {tickets.length === 0 ? (
            <AccountEmpty title="No tickets yet" body="When you submit a ticket, it will appear here with its status." />
          ) : (
            <ul className="space-y-2">
              {tickets.map((row) => (
                <li key={row.public_id} className="nexlo-card flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-[14px] font-bold text-[#0f1c3f]">{row.subject}</p>
                    <p className="mt-0.5 text-[12.5px] capitalize text-[#6b7587]">
                      {row.category} · {new Date(row.created_at).toLocaleString()}
                    </p>
                  </div>
                  <StatusPill status={row.status} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );

  if (compact) {
    return (
      <AccountSection
        title="Resolution Center"
        body={`Returns, cases, and tickets. Buyer protection lasts ${days} days after delivery.`}
        aside={
          <Link href="/resolution" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
            Open full Resolution Center →
          </Link>
        }
      >
        {body}
      </AccountSection>
    );
  }

  return body;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, StatusPill, when } from "@/components/admin/admin-ui";

type Ticket = {
  id: number;
  public_id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  email?: string;
  name?: string;
  created_at: string;
};

type TicketMessage = { id: number; body: string; created_at: string; sender_id?: number };

type Filter = "open" | "all" | "resolved" | "closed";

export default function AdminTicketsPage() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setRows((await accountApi<{ data: Ticket[] }>("/api/v1/admin/tickets")).data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load tickets"));
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "resolved") return rows.filter((r) => r.status === "resolved");
    if (filter === "closed") return rows.filter((r) => r.status === "closed");
    return rows.filter((r) => ["open", "assigned", "pending"].includes(r.status));
  }, [rows, filter]);

  const selected = rows.find((r) => r.public_id === selectedId) || null;
  const openCount = rows.filter((r) => ["open", "assigned", "pending"].includes(r.status)).length;

  useEffect(() => {
    if (!selectedId) {
      setThread([]);
      return;
    }
    accountApi<{ ticket: Ticket; messages: TicketMessage[] }>(`/api/v1/admin/tickets/${selectedId}`)
      .then((body) => setThread(body.messages || []))
      .catch(() => setThread([]));
  }, [selectedId]);

  async function update(status: string, withReply = false) {
    if (!selected) return;
    setError(null);
    if (withReply && reply.trim().length < 2) {
      setError("Write a short reply before resolving.");
      return;
    }
    setBusy(true);
    try {
      await accountApi(`/api/v1/admin/tickets/${selected.public_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          body: withReply ? reply.trim() : reply.trim() || undefined,
        }),
      });
      setNotice(`Ticket ${status}${withReply ? " with reply" : ""}.`);
      setReply("");
      await load();
      const refreshed = await accountApi<{ messages: TicketMessage[] }>(`/api/v1/admin/tickets/${selected.public_id}`);
      setThread(refreshed.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update ticket");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Support tickets</h1>
          <p className="text-[14px] text-[#6b7587]">Assign, reply, and close buyer or seller requests.</p>
        </div>
        {openCount > 0 ? (
          <span className="rounded-full bg-[#fff6e5] px-3 py-1.5 text-[13px] font-semibold text-[#b45309]">
            {openCount} open
          </span>
        ) : null}
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["open", "Open"],
            ["all", "All"],
            ["resolved", "Resolved"],
            ["closed", "Closed"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              filter === id ? "bg-[#3665f3] text-white" : "bg-[#f4f8fd] text-[#5b6780]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="nexlo-card overflow-hidden">
          <ul className="divide-y divide-[#eef2f7]">
            {visible.map((row) => {
              const active = selectedId === row.public_id;
              return (
                <li
                  key={row.public_id}
                  className={`cursor-pointer px-4 py-3 ${active ? "bg-[#eef4ff]" : "hover:bg-[#f8fbff]"}`}
                  onClick={() => setSelectedId(row.public_id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#0f1c3f]">{row.subject}</p>
                      <p className="text-[13px] text-[#6b7587]">
                        {row.name || row.email} · {row.category} · {row.priority} · {when(row.created_at)}
                      </p>
                    </div>
                    <StatusPill status={row.status} />
                  </div>
                </li>
              );
            })}
          </ul>
          {!visible.length ? <Empty title="No tickets" sub="New support requests will show up here." /> : null}
        </section>

        <aside className="nexlo-card h-fit p-5 xl:sticky xl:top-24">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Ticket</p>
                <h2 className="mt-1 text-[18px] font-extrabold text-[#0f1c3f]">{selected.subject}</h2>
                <p className="text-[13px] text-[#6b7587]">{selected.name || selected.email}</p>
              </div>
              <StatusPill status={selected.status} />
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl bg-[#f7fafd] p-3">
                {thread.length ? (
                  thread.map((msg) => (
                    <div key={msg.id} className="rounded-lg bg-white px-3 py-2 text-[13px] text-[#3a4a66] shadow-sm">
                      <p>{msg.body}</p>
                      <p className="mt-1 text-[11px] text-[#8a94a6]">{when(msg.created_at)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] text-[#8a94a6]">No messages yet.</p>
                )}
              </div>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                placeholder="Staff reply…"
                className="w-full rounded-xl border border-[#e7eef6] px-3 py-2 text-[13px]"
              />
              <div className="flex flex-col gap-2">
                <button type="button" disabled={busy} className="nexlo-btn nexlo-btn-blue" onClick={() => update("resolved", true)}>
                  Reply & resolve
                </button>
                <button type="button" disabled={busy} className="nexlo-btn-ghost h-10" onClick={() => update("pending")}>
                  Mark pending
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="h-10 rounded-full border border-[#e7eef6] text-[13px] font-semibold text-[#5b6780]"
                  onClick={() => update("closed")}
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <Empty title="Select a ticket" sub="Open a request to read the thread and reply." />
          )}
        </aside>
      </div>
    </div>
  );
}

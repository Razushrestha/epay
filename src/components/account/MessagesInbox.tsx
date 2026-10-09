"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";

type Thread = {
  id: number;
  subject: string | null;
  counterpart_name: string | null;
  counterpart_email: string | null;
  last_message: string | null;
  last_message_at: string;
  unread: number;
  listing_id: number | null;
};

type Msg = { id: number; sender_id: number; body: string; created_at: string; read_at: string | null };

export function MessagesInbox() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadThreads() {
    const body = await accountApi<{ data: Thread[] }>("/api/v1/conversations");
    setThreads(body.data);
    if (!active && body.data[0]) setActive(body.data[0].id);
  }

  async function loadMessages(id: number) {
    const body = await accountApi<{ messages: Msg[] }>(`/api/v1/conversations/${id}/messages`);
    setMessages(body.messages);
  }

  useEffect(() => {
    loadThreads().catch((err) => setError(err instanceof Error ? err.message : "Could not load messages"));
  }, []);

  useEffect(() => {
    if (active) loadMessages(active).catch(() => undefined);
  }, [active]);

  async function send() {
    if (!active || !draft.trim()) return;
    await accountApi(`/api/v1/conversations/${active}/messages`, { method: "POST", body: JSON.stringify({ body: draft }) });
    setDraft("");
    await loadMessages(active);
    await loadThreads();
  }

  const current = threads.find((t) => t.id === active);

  return (
    <section className="overflow-hidden nexlo-card">
      <div className="border-b border-[#eef2f7] px-6 py-5">
        <h1 className="text-[22px] font-extrabold text-[#0f1c3f]">Messages</h1>
        <p className="mt-1 text-[14px] text-[#6b7587]">Buyer and seller conversations stay in one inbox.</p>
      </div>
      {error ? <p className="px-6 py-3 text-[13px] text-red-700">{error}</p> : null}
      {threads.length === 0 ? (
        <p className="px-6 py-12 text-center text-[14px] text-[#6b7587]">No conversations yet. Message a seller from a listing.</p>
      ) : (
        <div className="grid min-h-[420px] lg:grid-cols-[280px_minmax(0,1fr)]">
          <ul className="border-r border-[#eef2f7]">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setActive(t.id)}
                  className={`w-full border-b border-[#f3f6fa] px-4 py-3 text-left ${active === t.id ? "bg-[#eaf1ff]" : "hover:bg-[#f7faff]"}`}
                >
                  <p className="flex items-center justify-between text-[13px] font-semibold text-[#0f1c3f]">
                    <span>{t.counterpart_name || t.counterpart_email || "Member"}</span>
                    {t.unread > 0 ? <span className="rounded-full bg-[#3665f3] px-1.5 text-[10px] text-white">{t.unread}</span> : null}
                  </p>
                  <p className="mt-1 line-clamp-1 text-[12px] text-[#6b7587]">{t.last_message || t.subject || "No messages"}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-col">
            <div className="border-b border-[#eef2f7] px-4 py-3 text-[14px] font-semibold text-[#0f1c3f]">
              {current?.counterpart_name || current?.counterpart_email || "Conversation"}
            </div>
            <div className="flex-1 space-y-2 overflow-auto p-4">
              {messages.map((m) => (
                <div key={m.id} className="rounded-xl bg-[#f7f7f7] px-3 py-2 text-[13px] text-[#0f1c3f]">
                  <p>{m.body}</p>
                  <p className="mt-1 text-[11px] text-[#8a94a6]">{new Date(m.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <form
              className="flex gap-2 border-t border-[#eef2f7] p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send().catch((err) => setError(err instanceof Error ? err.message : "Could not send"));
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message"
                className="h-10 flex-1 rounded-full border border-[#e2e8f0] px-4 text-[14px]"
              />
              <button className="h-10 rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white">Send</button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

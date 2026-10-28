"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { accountApi } from "@/lib/account-api";
import { AccountEmpty, AccountSection } from "@/components/account/AccountChrome";

type Thread = {
  id: number;
  subject: string | null;
  counterpart_name: string | null;
  counterpart_email: string | null;
  counterpart_username?: string | null;
  last_message: string | null;
  last_message_at: string;
  unread: number;
  listing_id: number | null;
  listing_title?: string | null;
};

type Msg = { id: number; sender_id: number; body: string; created_at: string; read_at: string | null };

function counterpart(t?: Thread | null) {
  return t?.counterpart_name || t?.counterpart_username || t?.counterpart_email || "Member";
}

export function MessagesInbox() {
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<number | null>(Number(searchParams.get("thread")) || null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [youId, setYouId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadThreads() {
    const body = await accountApi<{ data: Thread[] }>("/api/v1/conversations");
    setThreads(body.data);
    const wanted = Number(searchParams.get("thread")) || active || body.data[0]?.id || null;
    if (wanted) setActive(wanted);
  }

  async function loadMessages(id: number) {
    const body = await accountApi<{ messages: Msg[]; youId?: number }>(`/api/v1/conversations/${id}/messages`);
    setMessages(body.messages);
    if (body.youId) setYouId(Number(body.youId));
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
    <AccountSection
      title="Messages"
      body="Member-to-member conversations, including listing questions sent privately."
    >
      {error ? <p className="nexlo-alert nexlo-alert-error mb-4">{error}</p> : null}
      {threads.length === 0 ? (
        <AccountEmpty
          title="No conversations yet"
          body="Message a member from a listing or seller page. Replies show up here."
          action={
            <Link href="/search" className="nexlo-btn nexlo-btn-blue">
              Browse listings
            </Link>
          }
        />
      ) : (
        <section className="overflow-hidden nexlo-card">
          <div className="grid min-h-[420px] lg:grid-cols-[280px_minmax(0,1fr)]">
            <ul className="border-b border-[#eef2f7] lg:border-b-0 lg:border-r">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setActive(t.id)}
                    className={`w-full border-b border-[#f3f6fa] px-4 py-3 text-left ${active === t.id ? "bg-[#eaf1ff]" : "hover:bg-[#f7faff]"}`}
                  >
                    <p className="flex items-center justify-between gap-2 text-[13px] font-semibold text-[#0f1c3f]">
                      <span className="truncate">{counterpart(t)}</span>
                      {t.unread > 0 ? (
                        <span className="rounded-full bg-[#3665f3] px-1.5 text-[10px] font-bold text-white">{t.unread}</span>
                      ) : null}
                    </p>
                    <p className="mt-1 line-clamp-1 text-[12px] text-[#6b7587]">{t.last_message || t.subject || "No messages"}</p>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex min-h-[320px] flex-col">
              <div className="border-b border-[#eef2f7] px-4 py-3">
                <p className="text-[14px] font-semibold text-[#0f1c3f]">{counterpart(current)}</p>
                {current?.listing_id ? (
                  <Link href={`/listing/${current.listing_id}`} className="text-[12px] font-semibold text-[#3665f3] hover:underline">
                    {current.listing_title || `Listing #${current.listing_id}`}
                  </Link>
                ) : null}
              </div>
              <div className="flex-1 space-y-2 overflow-auto p-4">
                {messages.map((m) => {
                  const mine = youId != null && Number(m.sender_id) === youId;
                  return (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] ${mine ? "ml-auto bg-[#3665f3] text-white" : "bg-[#f4f8fd] text-[#0f1c3f]"}`}
                    >
                      <p>{m.body}</p>
                      <p className={`mt-1 text-[11px] ${mine ? "text-white/70" : "text-[#8a94a6]"}`}>
                        {new Date(m.created_at).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
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
                  className="nexlo-field flex-1"
                />
                <button type="submit" className="nexlo-btn nexlo-btn-blue h-10">
                  Send
                </button>
              </form>
            </div>
          </div>
        </section>
      )}
    </AccountSection>
  );
}

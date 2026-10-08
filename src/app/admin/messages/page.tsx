"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, when } from "@/components/admin/admin-ui";

type Message = {
  id: number;
  question: string;
  answer: string | null;
  created_at: string;
  listing_title: string;
  listing_id: number;
  from_name: string;
  email: string;
};

export default function AdminMessagesPage() {
  const [rows, setRows] = useState<Message[]>([]);
  const [reply, setReply] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const body = await accountApi<{ data: Message[] }>("/api/v1/admin/messages");
    setRows(body.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load messages"));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Messages</h1>
        <p className="text-[14px] text-[#6b7587]">Buyer questions on listings. Unanswered threads stay at the top.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      <div className="space-y-3">
        {rows.map((row) => (
          <section key={row.id} className="rounded-[22px] border border-[#e7eef6] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[#0f1c3f]">{row.from_name}</p>
                <p className="text-[12px] text-[#8a94a6]">{row.email} · {row.listing_title} · {when(row.created_at)}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${row.answer ? "bg-[#e7fbf4] text-[#12a37e]" : "bg-[#fff6e5] text-[#d97706]"}`}>
                {row.answer ? "Replied" : "Open"}
              </span>
            </div>
            <p className="mt-3 text-[14px] text-[#0f1c3f]">{row.question}</p>
            {row.answer ? <p className="mt-2 rounded-xl bg-[#f5f8fc] px-3 py-2 text-[13.5px] text-[#3a4a66]">{row.answer}</p> : (
              <form
                className="mt-3 flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await accountApi(`/api/v1/admin/messages/${row.id}`, { method: "POST", body: JSON.stringify({ answer: reply[row.id] }) });
                  setReply((c) => ({ ...c, [row.id]: "" }));
                  await load();
                }}
              >
                <input value={reply[row.id] ?? ""} onChange={(e) => setReply((c) => ({ ...c, [row.id]: e.target.value }))} placeholder="Write a reply…" className="h-10 flex-1 rounded-lg border border-[#e2e8f0] px-3" />
                <button className="h-10 rounded-full bg-[#2f6bff] px-4 text-[14px] font-semibold text-white">Send</button>
              </form>
            )}
          </section>
        ))}
        {!rows.length ? (
          <section className="rounded-[22px] border border-[#e7eef6] bg-white">
            <Empty title="No messages yet" sub="Questions buyers ask on listings will land here." />
          </section>
        ) : null}
      </div>
    </div>
  );
}

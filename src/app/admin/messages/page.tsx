"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  is_public?: boolean;
};

type Filter = "open" | "all" | "replied" | "hidden";

export default function AdminMessagesPage() {
  const [rows, setRows] = useState<Message[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const body = await accountApi<{ data: Message[] }>("/api/v1/admin/messages");
    setRows(body.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load messages"));
  }, []);

  const visible = useMemo(() => {
    if (filter === "open") return rows.filter((r) => !r.answer && r.is_public !== false);
    if (filter === "replied") return rows.filter((r) => Boolean(r.answer) && r.is_public !== false);
    if (filter === "hidden") return rows.filter((r) => r.is_public === false);
    return rows;
  }, [rows, filter]);

  const selected = rows.find((r) => r.id === selectedId) || null;
  const openCount = rows.filter((r) => !r.answer && r.is_public !== false).length;

  async function sendReply() {
    if (!selected) return;
    setError(null);
    if (reply.trim().length < 2) {
      setError("Write a reply before sending.");
      return;
    }
    setBusy(true);
    try {
      await accountApi(`/api/v1/admin/messages/${selected.id}`, {
        method: "POST",
        body: JSON.stringify({ answer: reply.trim() }),
      });
      setNotice("Reply posted.");
      setReply("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reply");
    } finally {
      setBusy(false);
    }
  }

  async function setPublic(isPublic: boolean) {
    if (!selected) return;
    setBusy(true);
    try {
      await accountApi(`/api/v1/admin/messages/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ public: isPublic, reason: isPublic ? undefined : "Staff hid Q&A" }),
      });
      setNotice(isPublic ? "Question made public again." : "Question hidden from listing.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update visibility");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Messages</h1>
          <p className="text-[14px] text-[#6b7587]">Buyer questions on listings. Unanswered threads stay at the top.</p>
        </div>
        {openCount > 0 ? (
          <span className="rounded-full bg-[#fff6e5] px-3 py-1.5 text-[13px] font-semibold text-[#b45309]">
            {openCount} unanswered
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
            ["replied", "Replied"],
            ["hidden", "Hidden"],
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="nexlo-card overflow-hidden">
          <ul className="divide-y divide-[#eef2f7]">
            {visible.map((row) => {
              const active = selectedId === row.id;
              return (
                <li
                  key={row.id}
                  className={`cursor-pointer px-4 py-3 ${active ? "bg-[#eef4ff]" : "hover:bg-[#f8fbff]"}`}
                  onClick={() => {
                    setSelectedId(row.id);
                    setReply("");
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#0f1c3f]">{row.from_name}</p>
                      <p className="text-[12px] text-[#8a94a6]">
                        {row.listing_title} · {when(row.created_at)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[13.5px] text-[#3a4a66]">{row.question}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                        row.is_public === false
                          ? "bg-[#eef2f7] text-[#6b7587]"
                          : row.answer
                            ? "bg-[#e7fbf4] text-[#12a37e]"
                            : "bg-[#fff6e5] text-[#d97706]"
                      }`}
                    >
                      {row.is_public === false ? "Hidden" : row.answer ? "Replied" : "Open"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {!visible.length ? <Empty title="No messages in this filter" sub="Questions buyers ask on listings will land here." /> : null}
        </section>

        <aside className="nexlo-card h-fit p-5 xl:sticky xl:top-24">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Question</p>
                <h2 className="mt-1 text-[16px] font-extrabold text-[#0f1c3f]">{selected.from_name}</h2>
                <p className="text-[13px] text-[#6b7587]">{selected.email}</p>
              </div>
              <p className="text-[14px] text-[#0f1c3f]">{selected.question}</p>
              {selected.answer ? (
                <p className="rounded-xl bg-[#f4f8fd] px-3 py-2 text-[13.5px] text-[#3a4a66]">{selected.answer}</p>
              ) : (
                <>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    placeholder="Write a staff reply…"
                    className="w-full rounded-xl border border-[#e7eef6] px-3 py-2 text-[13px]"
                  />
                  <button type="button" disabled={busy} className="nexlo-btn nexlo-btn-blue w-full" onClick={sendReply}>
                    Send reply
                  </button>
                </>
              )}
              <div className="flex flex-col gap-2 border-t border-[#eef2f7] pt-3">
                {selected.is_public === false ? (
                  <button type="button" disabled={busy} className="nexlo-btn-ghost h-10" onClick={() => setPublic(true)}>
                    Unhide on listing
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    className="h-10 rounded-full border border-[#e7eef6] text-[13px] font-semibold text-[#5b6780]"
                    onClick={() => setPublic(false)}
                  >
                    Hide from listing
                  </button>
                )}
                <Link href={`/listing/${selected.listing_id}`} className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                  Open listing →
                </Link>
              </div>
            </div>
          ) : (
            <Empty title="Select a message" sub="Reply as staff or hide inappropriate Q&A." />
          )}
        </aside>
      </div>
    </div>
  );
}

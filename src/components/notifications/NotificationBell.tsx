"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi, getToken } from "@/lib/account-api";

type Note = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [rows, setRows] = useState<Note[]>([]);

  async function load() {
    if (!getToken()) return;
    try {
      const body = await accountApi<{ data: Note[]; unread: number }>("/api/v1/notifications");
      setRows(body.data);
      setUnread(body.unread);
    } catch {
      /* signed out or API down */
    }
  }

  useEffect(() => {
    load();
    const t = window.setInterval(load, 20000);
    return () => window.clearInterval(t);
  }, []);

  async function markRead() {
    setOpen((v) => !v);
    if (!open && unread > 0) {
      try {
        await accountApi("/api/v1/notifications/read", { method: "POST", body: "{}" });
        setUnread(0);
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="relative">
      <button type="button" aria-label="Notifications" onClick={markRead} className="relative rounded-full p-2 text-[#3a4a66] hover:bg-[#f3f7fc]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <path d="M6 9a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff4d6d] px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[320px] overflow-hidden rounded-2xl border border-[#e7eef6] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#eef2f7] px-4 py-3">
            <p className="text-[14px] font-bold text-[#0f1c3f]">Notifications</p>
            <Link href="/account?tab=preferences" className="text-[12px] text-[#2f6bff]" onClick={() => setOpen(false)}>
              Preferences
            </Link>
          </div>
          <ul className="max-h-[360px] overflow-auto">
            {rows.length === 0 ? (
              <li className="px-4 py-8 text-center text-[13px] text-[#8a94a6]">No notifications yet.</li>
            ) : (
              rows.map((row) => (
                <li key={row.id} className="border-b border-[#f3f6fa]">
                  <Link href={row.href || "/account"} className="block px-4 py-3 hover:bg-[#f7faff]" onClick={() => setOpen(false)}>
                    <p className="text-[13px] font-semibold text-[#0f1c3f]">{row.title}</p>
                    {row.body ? <p className="mt-0.5 line-clamp-2 text-[12px] text-[#6b7587]">{row.body}</p> : null}
                    <p className="mt-1 text-[11px] text-[#8a94a6]">{new Date(row.created_at).toLocaleString()}</p>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

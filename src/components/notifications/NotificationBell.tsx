"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { accountApi, getToken } from "@/lib/account-api";
import type { AdminQueues } from "@/lib/staff-nav";

type Note = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

const QUEUE_LINKS: { key: keyof AdminQueues; label: string; href: string }[] = [
  { key: "kyc", label: "KYC", href: "/admin/kyc" },
  { key: "appeals", label: "Appeals", href: "/admin/appeals" },
  { key: "payouts", label: "Payouts", href: "/admin/payouts" },
  { key: "disputes", label: "Disputes", href: "/admin/disputes" },
  { key: "tickets", label: "Tickets", href: "/admin/tickets" },
  { key: "moderation", label: "Moderation", href: "/admin/moderation" },
  { key: "messages", label: "Messages", href: "/admin/messages" },
];

export function NotificationBell({
  variant = "default",
  queues = {},
  live = false,
}: {
  variant?: "default" | "staff";
  queues?: AdminQueues;
  live?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [rows, setRows] = useState<Note[]>([]);
  const staff = variant === "staff";
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Phones render the panel as a full-width sheet pinned under the bell's row,
  // so we track where that row ends (bell bottom) instead of anchoring to the bell's x.
  const [sheetTop, setSheetTop] = useState(64);

  const measure = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setSheetTop(Math.max(8, Math.round(rect.bottom + 8)));
  }, []);

  useEffect(() => {
    if (!open) return;
    measure();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, measure]);

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
    const t = window.setInterval(load, staff ? 15000 : 20000);
    return () => window.clearInterval(t);
  }, [staff]);

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

  const queueTotal = QUEUE_LINKS.reduce((sum, item) => sum + Number(queues[item.key] || 0), 0);
  const badge = staff ? unread + queueTotal : unread;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={staff ? "Staff inbox" : "Notifications"}
        aria-expanded={open}
        onClick={markRead}
        className="relative rounded-full p-2 text-[#3a4a66] hover:bg-[#f3f7fc]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <path d="M6 9a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {badge > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff4d6d] px-1 text-[10px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
        {staff && live ? (
          <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-[#12a37e] ring-2 ring-white" title="Live queues" />
        ) : null}
      </button>
      {open ? (
        <button
          type="button"
          aria-label="Close notifications"
          tabIndex={-1}
          className="fixed inset-0 z-30 cursor-default bg-[#0f1c3f]/25 sm:bg-transparent"
          onClick={() => setOpen(false)}
        />
      ) : null}
      {open ? (
        <div
          role="dialog"
          aria-label={staff ? "Staff inbox" : "Notifications"}
          style={{ ["--np-top" as string]: `${sheetTop}px` }}
          className={`fixed inset-x-3 top-[var(--np-top)] z-40 flex max-h-[calc(100dvh-var(--np-top)-0.75rem)] flex-col overflow-hidden rounded-2xl border border-[#e7eef6] bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[min(80dvh,560px)] sm:w-[min(calc(100vw-1.5rem),var(--np-w))] ${
            staff ? "sm:[--np-w:380px]" : "sm:[--np-w:340px]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#eef2f7] px-4 py-3">
            <div>
              <p className="text-[14px] font-bold text-[#0f1c3f]">{staff ? "Staff inbox" : "Notifications"}</p>
              {staff ? (
                <p className="text-[11px] text-[#8a94a6]">{live ? "Live queue feed connected" : "Polling queues"}</p>
              ) : null}
            </div>
            <Link
              href={staff ? "/admin" : "/account?tab=preferences"}
              className="shrink-0 rounded-lg px-2 py-1.5 text-[13px] font-medium text-[#3665f3] hover:bg-[#f3f7fc] sm:text-[12px]"
              onClick={() => setOpen(false)}
            >
              {staff ? "Dashboard" : "Preferences"}
            </Link>
          </div>

          {staff ? (
            <div className="border-b border-[#eef2f7] bg-[#f7faff] px-3 py-3">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#8a94a6]">Action queues</p>
              <div className="grid grid-cols-2 gap-1.5">
                {QUEUE_LINKS.map((item) => {
                  const count = Number(queues[item.key] || 0);
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-[12.5px] ${
                        count > 0 ? "bg-white text-[#0f1c3f] shadow-sm" : "text-[#8a94a6]"
                      }`}
                    >
                      <span className="font-medium">{item.label}</span>
                      <span className={`font-bold ${count > 0 ? "text-[#e5484d]" : ""}`}>{count}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {rows.length === 0 ? (
              <li className="px-4 py-8 text-center text-[13px] text-[#8a94a6]">
                {staff ? "No personal staff notes yet. Queue badges above stay live." : "No notifications yet."}
              </li>
            ) : (
              rows.map((row) => (
                <li key={row.id} className="border-b border-[#f3f6fa]">
                  <Link
                    href={row.href || (staff ? "/admin" : "/account")}
                    className="block px-4 py-3.5 hover:bg-[#f7faff] active:bg-[#f0f5fc] sm:py-3"
                    onClick={() => setOpen(false)}
                  >
                    <p className="break-words text-[14px] font-semibold text-[#0f1c3f] sm:text-[13px]">{row.title}</p>
                    {row.body ? <p className="mt-0.5 line-clamp-2 break-words text-[13px] text-[#6b7587] sm:text-[12px]">{row.body}</p> : null}
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

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { initials } from "@/components/account/AccountChrome";

type FeedbackUser = {
  id: string;
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  country: string | null;
  avatarUrl: string | null;
  createdAt?: string | null;
  feedback: { positive: number; neutral: number; negative: number };
};

type FeedbackRow = {
  public_id: string;
  rating: "positive" | "neutral" | "negative";
  comment: string | null;
  created_at: string;
  from_name?: string | null;
  to_name?: string | null;
};

type FeedTab = "all" | "buyer" | "seller" | "left";

const TABS: { id: FeedTab; label: string }[] = [
  { id: "all", label: "All received Feedback" },
  { id: "buyer", label: "Received as buyer" },
  { id: "seller", label: "Received as seller" },
  { id: "left", label: "Left for others" },
];

function handle(user: FeedbackUser) {
  if (user.username) return user.username;
  const base = (user.email?.split("@")[0] || user.firstName || "user").replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
  return `${base}-${user.id.slice(-4)}`;
}

function memberSince(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "—";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]}-${String(d.getDate()).padStart(2, "0")}-${String(d.getFullYear()).slice(-2)}`;
}

function whenLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function InfoTip({ text }: { text: string }) {
  return (
    <span title={text} className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#c5d0e0] text-[10px] font-bold text-[#8a94a6]">
      i
    </span>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className={filled ? "fill-[#f5c518] text-[#f5c518]" : "fill-none text-[#d5dce8]"}>
      <path
        d="M12 3.6 14.4 9l6 .5-4.6 3.9 1.5 5.8L12 16.6 6.7 19.2 8.2 13.4 3.6 9.5 9.6 9 12 3.6Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RatingPill({ kind, count, pct }: { kind: "positive" | "neutral" | "negative"; count: number; pct: number }) {
  const meta = {
    positive: { label: "Positive", color: "text-[#12a37e]", bg: "bg-[#e7fbf4]", mark: "+" },
    neutral: { label: "Neutral", color: "text-[#6b7587]", bg: "bg-[#eef2f7]", mark: "−" },
    negative: { label: "Negative", color: "text-[#e5484d]", bg: "bg-[#fdecec]", mark: "−" },
  }[kind];
  return (
    <div className="flex flex-1 flex-col items-center px-2 py-1">
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[15px] font-bold ${meta.bg} ${meta.color}`}>{meta.mark}</span>
        <span className="text-[15px] font-semibold text-[#0f1c3f]">{meta.label}</span>
      </div>
      <p className="mt-3 text-[28px] font-extrabold leading-none text-[#0f1c3f]">{count}</p>
      <p className="mt-1 text-[13px] text-[#8a94a6]">({pct}%)</p>
    </div>
  );
}

export function FeedbackBoard({ user }: { user: FeedbackUser }) {
  const [received, setReceived] = useState<FeedbackRow[]>([]);
  const [left, setLeft] = useState<FeedbackRow[]>([]);
  const [feedTab, setFeedTab] = useState<FeedTab>("all");
  const [visible, setVisible] = useState(true);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [profileOpen, setProfileOpen] = useState(false);
  const pageSize = 8;

  const pos = user.feedback.positive;
  const neu = user.feedback.neutral;
  const neg = user.feedback.negative;
  const total = pos + neu + neg;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const average = total ? (pos * 5 + neu * 3 + neg * 1) / total : 0;
  const filledStars = total ? Math.round(average) : 0;

  useEffect(() => {
    accountApi<{ received?: FeedbackRow[]; left?: FeedbackRow[] }>("/api/v1/account/feedback")
      .then((body) => {
        setReceived(Array.isArray(body.received) ? body.received : []);
        setLeft(Array.isArray(body.left) ? body.left : []);
      })
      .catch(() => undefined);
  }, []);

  const source = useMemo(() => {
    if (feedTab === "left") return left;
    if (feedTab === "buyer") return [] as FeedbackRow[];
    return received;
  }, [feedTab, left, received]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const q = query.trim().toLowerCase();
    let rows = source.filter((row) => {
      if (period === "30") return now - new Date(row.created_at).getTime() <= 30 * 86400000;
      if (period === "12m") return now - new Date(row.created_at).getTime() <= 365 * 86400000;
      return true;
    });
    if (q) {
      rows = rows.filter((row) =>
        [row.comment, row.from_name, row.to_name, row.public_id, row.rating].some((v) => String(v ?? "").toLowerCase().includes(q)),
      );
    }
    rows = [...rows].sort((a, b) => {
      if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === "rating") return a.rating.localeCompare(b.rating);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return rows;
  }, [source, query, period, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const slice = filtered.slice((current - 1) * pageSize, current * pageSize);
  const emptyCopy =
    feedTab === "left"
      ? { title: "No feedback left yet", sub: "Feedback you leave for other members will show up here." }
      : { title: "No feedback received yet", sub: "Your feedback will appear here once you start buying or selling." };

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[22px] bg-[linear-gradient(100deg,#eaf4ff_0%,#f4f9ff_55%,#eef6ff_100%)] px-5 py-5 sm:px-7">
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white text-[#2f6bff] shadow-[0_8px_24px_rgba(47,107,255,0.12)]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4 3.2V6.5Z" />
                <path d="M9 9.5h6M9 12.5h4" />
              </svg>
            </span>
            <div>
              <h1 className="text-[28px] font-extrabold tracking-tight text-[#0f1c3f]">Feedback</h1>
              <p className="mt-0.5 text-[14px] text-[#6b7587]">Your feedback helps us improve and serve you better.</p>
            </div>
          </div>
          <div className="relative hidden h-[108px] w-[220px] shrink-0 sm:block">
            <span className="absolute right-16 top-2 h-2 w-2 rounded-full bg-[#7ee7d6]" />
            <span className="absolute right-6 top-8 h-1.5 w-1.5 rounded-full bg-[#2f6bff]" />
            <span className="absolute bottom-4 right-24 text-[#7ee7d6]">✦</span>
            <div className="absolute right-0 top-3 rounded-[28px] bg-white/90 px-5 py-4 shadow-[0_12px_30px_rgba(47,107,255,0.14)]">
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} filled />
                ))}
              </div>
            </div>
            <svg viewBox="0 0 90 40" className="absolute bottom-1 right-10 w-24 text-[#cfe4ff]" aria-hidden>
              <path d="M8 28c10-18 22-18 32 0 10 18 22 18 32 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <section className="rounded-[22px] border border-[#e7eef6] bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Feedback Profile</h2>
            <button type="button" aria-label="Profile options" onClick={() => setProfileOpen((v) => !v)} className="rounded-full p-1 text-[#8a94a6] hover:bg-[#f5f8fc]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={profileOpen ? "rotate-180" : ""}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#edf1f6] text-[16px] font-bold text-[#8a94a6]">
                {initials(user)}
              </span>
            )}
            <div>
              <p className="flex items-center gap-1.5 text-[15px] font-semibold text-[#0f1c3f]">
                {handle(user)}
                <span aria-hidden className="text-[14px]">🏆</span>
              </p>
              <p className="mt-0.5 text-[13px] text-[#6b7587]">
                Member since: {memberSince(user.createdAt)} in {user.country || "Nepal"}
              </p>
            </div>
          </div>
          {profileOpen ? (
            <p className="mt-3 rounded-xl bg-[#f5f8fc] px-3 py-2 text-[13px] text-[#5b6780]">
              This is how other members see your public feedback profile.
            </p>
          ) : null}
        </section>

        <section className="rounded-[22px] border border-[#e7eef6] bg-white px-5 py-4">
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-[#0f1c3f]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2f6bff" strokeWidth="1.8" aria-hidden>
              <path d="M10 13a5 5 0 0 0 7.1 0l1.4-1.4a5 5 0 0 0-7.1-7.1L10 5.9" />
              <path d="M14 11a5 5 0 0 0-7.1 0L5.5 12.4a5 5 0 0 0 7.1 7.1L14 18.1" />
            </svg>
            Member Quick Links
          </h2>
          <ul className="mt-2">
            {[
              ["/account?tab=messages", "Contact member"],
              ["/account?tab=activity", "Report a buyer"],
              ["/account?tab=selling", "View seller dashboard"],
              ["/sell/listings", "View items for sale"],
            ].map(([href, label]) => (
              <li key={label} className="border-t border-[#eef2f7] first:border-t-0">
                <Link href={href} className="flex items-center justify-between py-2.5 text-[14px] text-[#3a4a66] hover:text-[#2f6bff]">
                  {label}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <section className="rounded-[22px] border border-[#e7eef6] bg-white px-5 py-5">
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-[#0f1c3f]">
            Feedback Ratings
            <InfoTip text="Counts of positive, neutral, and negative feedback left for you as a seller." />
          </h2>
          <div className="mt-4 flex divide-x divide-[#e8edf3]">
            <RatingPill kind="positive" count={pos} pct={pct(pos)} />
            <RatingPill kind="neutral" count={neu} pct={pct(neu)} />
            <RatingPill kind="negative" count={neg} pct={pct(neg)} />
          </div>
        </section>

        <section className="rounded-[22px] border border-[#e7eef6] bg-white px-5 py-5">
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-[#0f1c3f]">
            Detailed seller ratings
            <InfoTip text="Detailed ratings appear after you receive at least 10 seller ratings." />
          </h2>
          <p className="mt-3 text-[13px] text-[#6b7587]">Average for the last 12 months</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} filled={total === 0 || i < filledStars} />
              ))}
            </span>
            <span className="text-[18px] font-extrabold text-[#0f1c3f]">{average.toFixed(1)}</span>
            <span className="text-[13px] text-[#8a94a6]">({total} ratings)</span>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-[#8a94a6]">
            This information will be available when this member receives at least 10 detailed seller ratings.
          </p>
        </section>
      </div>

      <section className="overflow-hidden rounded-[22px] border border-[#e7eef6] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef2f7] px-5">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setFeedTab(item.id);
                  setPage(1);
                }}
                className={`relative px-2 py-3.5 text-[13.5px] sm:px-3 ${
                  feedTab === item.id ? "font-semibold text-[#2f6bff]" : "font-medium text-[#6b7587] hover:text-[#0f1c3f]"
                }`}
              >
                {item.label}
                {feedTab === item.id ? <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[#2f6bff]" /> : null}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 py-3 text-[13px] text-[#3a4a66]">
            <button
              type="button"
              role="switch"
              aria-checked={visible}
              onClick={() => setVisible((v) => !v)}
              className={`relative h-[22px] w-[40px] rounded-full transition ${visible ? "bg-[#2f6bff]" : "bg-[#d5dce8]"}`}
            >
              <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition ${visible ? "left-[20px]" : "left-[3px]"}`} />
            </button>
            Visible to everyone
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <p className="text-[13.5px] text-[#3a4a66]">
            {filtered.length} Feedback {feedTab === "left" ? "left" : "received"}
          </p>
          <p className="flex items-center gap-1.5 text-[13px] text-[#6b7587]">
            Feedback revision requests available: <span className="font-semibold text-[#0f1c3f]">5</span>
            <InfoTip text="You can ask a member to revise feedback they left for you." />
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3 px-5 pb-4">
          <label className="relative min-w-[240px] flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a94a6]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search feedback with item title, item ID or User ID..."
              className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-[#fbfcfe] pl-9 pr-10 text-[13.5px] outline-none placeholder:text-[#9aa3b2] focus:border-[#2f6bff]"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#c5d0e0]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                <rect x="4" y="5" width="16" height="15" rx="2" />
                <path d="M8 3v4M16 3v4M4 10h16" />
              </svg>
            </span>
          </label>
          <label className="w-[140px] text-[12px] font-medium text-[#6b7587]">
            Period
            <select
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPage(1);
              }}
              className="mt-1 h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-2 text-[13.5px] text-[#0f1c3f] outline-none"
            >
              <option value="all">All</option>
              <option value="30">Last 30 days</option>
              <option value="12m">Last 12 months</option>
            </select>
          </label>
          <label className="w-[160px] text-[12px] font-medium text-[#6b7587]">
            Sort By:
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-2 text-[13.5px] text-[#0f1c3f] outline-none"
            >
              <option value="recent">Most recent</option>
              <option value="oldest">Oldest</option>
              <option value="rating">Rating</option>
            </select>
          </label>
        </div>

        <div className="overflow-x-auto px-5 pb-2">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-y border-[#eef2f7] text-[11px] font-semibold tracking-[0.08em] text-[#8a94a6]">
                <th className="py-3 font-semibold">FEEDBACK</th>
                <th className="py-3 font-semibold">{feedTab === "left" ? "TO" : "FROM"}</th>
                <th className="py-3 font-semibold">WHEN</th>
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center">
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eef6ff] text-[#2f6bff]">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                        <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4 3.2V6.5Z" />
                        <path d="M12 8.6 12.9 10.7 15.2 11l-1.7 1.5.5 2.3L12 13.7 10 14.8l.5-2.3L8.8 11l2.3-.3L12 8.6Z" fill="currentColor" stroke="none" />
                      </svg>
                    </span>
                    <p className="mt-4 text-[16px] font-bold text-[#0f1c3f]">{emptyCopy.title}</p>
                    <p className="mt-1 text-[13.5px] text-[#8a94a6]">{emptyCopy.sub}</p>
                  </td>
                </tr>
              ) : (
                slice.map((row) => (
                  <tr key={row.public_id} className="border-b border-[#f1f4f8] text-[13.5px]">
                    <td className="py-3 pr-4">
                      <span
                        className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                          row.rating === "positive"
                            ? "bg-[#e7fbf4] text-[#12a37e]"
                            : row.rating === "negative"
                              ? "bg-[#fdecec] text-[#e5484d]"
                              : "bg-[#eef2f7] text-[#6b7587]"
                        }`}
                      >
                        {row.rating}
                      </span>
                      {row.comment || "No comment"}
                    </td>
                    <td className="py-3 pr-4 text-[#3a4a66]">{feedTab === "left" ? row.to_name : row.from_name}</td>
                    <td className="py-3 text-[#6b7587]">{whenLabel(row.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-4 text-[13px] text-[#6b7587]">
          <p>
            Page {current} of {pages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={current <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#8a94a6] disabled:opacity-40"
              aria-label="Previous page"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
            <span className="flex h-8 min-w-8 items-center justify-center border-b-2 border-[#0f1c3f] font-semibold text-[#0f1c3f]">{current}</span>
            <button
              type="button"
              disabled={current >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#8a94a6] disabled:opacity-40"
              aria-label="Next page"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

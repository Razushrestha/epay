"use client";

import Link from "next/link";
import { Caveat } from "next/font/google";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { clock, Donut, greeting, lastDays, LineChart, longDate, money, Sparkline, StatusPill, when } from "@/components/admin/admin-ui";
import { canAccessNav, normalizeStaffRole } from "@/lib/staff-nav";

const script = Caveat({ subsets: ["latin"], weight: ["600", "700"] });

type Overview = {
  stats: {
    users: { total: number; change: number };
    orders: { total: number; change: number };
    products: { total: number; change: number };
    revenue: { total: number; change: number };
  };
  series: { day: string; users: number; orders: number; products: number; revenue: number }[];
  orderStatus: { completed: number; processing: number; pending: number; cancelled: number; total: number };
  recentOrders: {
    order_number: string;
    customer: string;
    product: string | null;
    total_amount: number;
    status: string;
    created_at: string;
    photo_url?: string | null;
    thumbnail_url?: string | null;
  }[];
  activity: { kind: string; title: string; detail: string; at: string }[];
  queues?: {
    kyc?: number;
    appeals?: number;
    payouts?: number;
    disputes?: number;
    tickets?: number;
    moderation?: number;
    messages?: number;
  };
};

function Change({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <p className={`mt-2 flex items-center gap-1 text-[12.5px] font-medium ${up ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
      <span>{up ? "↑" : "↓"}</span> {Math.abs(value)}% <span className="font-normal text-[#8a94a6]">vs. last month</span>
    </p>
  );
}

const activityMeta: Record<string, { bg: string; color: string }> = {
  user: { bg: "bg-[#eaf1ff]", color: "text-[#3665f3]" },
  order: { bg: "bg-[#e7fbf4]", color: "text-[#12a37e]" },
  product: { bg: "bg-[#fff6e5]", color: "text-[#d97706]" },
  message: { bg: "bg-[#eaf1ff]", color: "text-[#3665f3]" },
  refund: { bg: "bg-[#fdecec]", color: "text-[#e5484d]" },
};

function Banner() {
  return (
    <section className="relative overflow-hidden rounded-[22px] bg-[linear-gradient(115deg,#d7ecff_0%,#e7f6ff_48%,#d8f6ef_100%)] px-5 py-5">
      <svg viewBox="0 0 280 120" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d="M0 80 C 50 40, 90 110, 150 70 S 230 20, 280 60 L280 120 L0 120 Z" fill="#cfefff" opacity=".55" />
        <path d="M0 95 C 70 60, 110 120, 180 80 S 250 50, 280 75 L280 120 L0 120 Z" fill="#b7f0e4" opacity=".45" />
      </svg>
      <div className="relative z-10 flex items-center justify-between gap-3">
        <svg viewBox="0 0 140 88" className="h-[88px] w-[140px] shrink-0" aria-hidden>
          <path d="M8 70 C 30 70, 38 42, 58 42 S 78 62, 98 28" fill="none" stroke="#7ee7d6" strokeWidth="4" strokeLinecap="round" />
          <path d="M86 22l22-14 8 6" fill="none" stroke="#16a34a" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="86" y="42" width="14" height="34" rx="4" fill="#9ec4ff" />
          <rect x="104" y="30" width="14" height="46" rx="4" fill="#5b93ff" />
          <rect x="122" y="18" width="14" height="58" rx="4" fill="#3665f3" />
        </svg>
        <p className={`${script.className} text-right text-[28px] leading-[1.05] text-[#1d4ed8]`}>
          Better Insights
          <br />
          <span className="text-[#0f9f86]">Bigger Growth</span>
        </p>
      </div>
    </section>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Admin");
  const [role, setRole] = useState("support");

  useEffect(() => {
    accountApi<{ user: { firstName: string | null; displayName: string | null; staffRole?: string | null; isStaff?: boolean } }>(
      "/api/v1/account",
    )
      .then((b) => {
        setName(b.user.firstName || b.user.displayName || "Admin");
        setRole(normalizeStaffRole(b.user.staffRole, Boolean(b.user.isStaff)));
      })
      .catch(() => undefined);
    accountApi<Overview>("/api/v1/admin/overview")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load dashboard"));
  }, []);

  const fallbackDays = lastDays(7);
  const series = data?.series?.length
    ? data.series
    : fallbackDays.map((day) => ({ day, users: 0, orders: 0, products: 0, revenue: 0 }));
  const labels = series.map((row) => {
    const d = new Date(row.day);
    return `${d.toLocaleString("en-GB", { month: "short" })} ${String(d.getDate()).padStart(2, "0")}`;
  });
  const stats = [
    { label: "Total Users", value: data?.stats.users.total ?? 0, change: data?.stats.users.change ?? 0, color: "#3665f3", bg: "bg-[#eef4ff]", spark: series.map((s) => s.users) },
    { label: "Total Orders", value: data?.stats.orders.total ?? 0, change: data?.stats.orders.change ?? 0, color: "#12a37e", bg: "bg-[#eafaf3]", spark: series.map((s) => s.orders) },
    { label: "Total Products", value: data?.stats.products.total ?? 0, change: data?.stats.products.change ?? 0, color: "#7c5cfc", bg: "bg-[#f4f0ff]", spark: series.map((s) => s.products) },
    { label: "Total Revenue", value: data?.stats.revenue.total ?? 0, change: data?.stats.revenue.change ?? 0, color: "#3665f3", bg: "bg-[#eef6ff]", spark: series.map((s) => s.revenue), money: true },
  ];
  const os = data?.orderStatus ?? { completed: 0, processing: 0, pending: 0, cancelled: 0, total: 0 };
  const q = data?.queues ?? {};
  const queues = [
    { id: "kyc", href: "/admin/kyc", label: "KYC pending", count: q.kyc ?? 0, tone: "bg-[#fff6e5] text-[#b45309]" },
    { id: "disputes", href: "/admin/disputes", label: "Open disputes", count: q.disputes ?? 0, tone: "bg-[#fdecec] text-[#e5484d]" },
    { id: "payouts", href: "/admin/payouts", label: "Payouts waiting", count: q.payouts ?? 0, tone: "bg-[#eafaf3] text-[#0f9f76]" },
    { id: "moderation", href: "/admin/moderation", label: "Moderation", count: q.moderation ?? 0, tone: "bg-[#f4f0ff] text-[#7c5cfc]" },
    { id: "tickets", href: "/admin/tickets", label: "Open tickets", count: q.tickets ?? 0, tone: "bg-[#eef4ff] text-[#3665f3]" },
    { id: "appeals", href: "/admin/appeals", label: "Appeals", count: q.appeals ?? 0, tone: "bg-[#eef4ff] text-[#3665f3]" },
  ].filter((item) => canAccessNav(role, item.id));
  const openQueueCount = queues.reduce((sum, item) => sum + item.count, 0);
  const actions = [
    { id: "users", href: "/admin/users?new=1", label: "Add New User" },
    { id: "products", href: "/admin/products", label: "Add Product" },
    { id: "orders", href: "/admin/orders", label: "View Orders" },
    { id: "messages", href: "/admin/messages", label: "Send Message" },
  ].filter((item) => canAccessNav(role, item.id));

  return (
    <div className="grid gap-5 pb-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}

        <div>
          <p className="text-[16px] text-[#6b7587]">{greeting()},</p>
          <h1 className="mt-0.5 text-[34px] font-extrabold tracking-tight text-[#0f1c3f]">
            {name}!
          </h1>
          <p className="mt-1 text-[14.5px] text-[#6b7587]">
            {openQueueCount > 0
              ? `${openQueueCount.toLocaleString()} items need attention across KYC, disputes, payouts, and support.`
              : "Here's what's happening with your platform today. Queues are clear."}
          </p>
          <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-[#8a94a6]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="4" y="5" width="16" height="15" rx="2" />
              <path d="M8 3v4M16 3v4M4 10h16" />
            </svg>
            {longDate()}
          </p>
        </div>

        <section className="rounded-[22px] bg-white p-4 shadow-[0_8px_30px_rgba(15,28,63,0.04)] sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Action queues</h2>
              <p className="text-[13px] text-[#8a94a6]">Jump straight into work that is waiting on staff.</p>
            </div>
            {openQueueCount > 0 ? (
              <span className="rounded-full bg-[#fff5f5] px-3 py-1 text-[12px] font-semibold text-[#e53238]">
                {openQueueCount} open
              </span>
            ) : (
              <span className="rounded-full bg-[#ecfdf5] px-3 py-1 text-[12px] font-semibold text-[#047857]">All clear</span>
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {queues.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 transition hover:brightness-[0.98] ${item.tone}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">{item.label}</span>
                  <span className="block text-[12px] opacity-80">{item.count ? "Needs review" : "Nothing waiting"}</span>
                </span>
                <span className="text-[22px] font-extrabold tabular-nums">{item.count}</span>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((card) => (
            <section key={card.label} className={`rounded-[22px] ${card.bg} p-4`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-[13px] font-medium text-[#5b6780]">
                  {card.label}
                </div>
                <Sparkline values={card.spark} color={card.color} />
              </div>
              <p className="mt-3 text-[28px] font-extrabold tracking-tight text-[#0f1c3f]">
                {card.money ? money(card.value) : card.value.toLocaleString()}
              </p>
              <Change value={card.change} />
            </section>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(260px,.85fr)]">
          <section className="rounded-[22px] bg-white p-5 shadow-[0_8px_30px_rgba(15,28,63,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Overview</h2>
                <p className="text-[13px] text-[#8a94a6]">Your platform performance at a glance</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="hidden items-center gap-4 text-[12px] text-[#5b6780] sm:flex">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#3665f3]" /> Revenue</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#12a37e]" /> Orders</span>
                </span>
                <button type="button" className="inline-flex items-center gap-1 rounded-full border border-[#e7eef6] px-3 py-1 text-[12px] text-[#5b6780]">
                  Last 7 days
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m6 9 6 6 6-6" /></svg>
                </button>
              </div>
            </div>
            <LineChart
              labels={labels}
              series={[
                { name: "Revenue", color: "#3665f3", values: series.map((s) => s.revenue), fill: true },
                { name: "Orders", color: "#12a37e", values: series.map((s) => s.orders) },
              ]}
            />
          </section>

          <section className="rounded-[22px] bg-white p-5 shadow-[0_8px_30px_rgba(15,28,63,0.04)]">
            <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Order Status</h2>
            <div className="mt-5">
              <Donut
                total={os.total}
                segments={[
                  { label: "Completed", value: os.completed, color: "#22c55e" },
                  { label: "Processing", value: os.processing, color: "#3b82f6" },
                  { label: "Pending", value: os.pending, color: "#f59e0b" },
                  { label: "Cancelled", value: os.cancelled, color: "#ef4444" },
                ]}
              />
            </div>
          </section>
        </div>

        <section className="rounded-[22px] bg-white p-5 shadow-[0_8px_30px_rgba(15,28,63,0.04)]">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Recent Orders</h2>
            <Link href="/admin/orders" className="text-[13px] font-medium text-[#3665f3] hover:underline">View all →</Link>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-[#eef2f7] text-[12px] font-medium text-[#8a94a6]">
                  <th className="py-3 font-medium">Order ID</th>
                  <th className="py-3 font-medium">Customer</th>
                  <th className="py-3 font-medium">Product</th>
                  <th className="py-3 font-medium">Amount</th>
                  <th className="py-3 font-medium">Status</th>
                  <th className="py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentOrders ?? []).map((row) => (
                  <tr key={row.order_number} className="border-b border-[#f3f6fa] last:border-b-0">
                    <td className="py-3.5 font-semibold text-[#3665f3]">#{row.order_number}</td>
                    <td className="py-3.5 text-[#0f1c3f]">{row.customer}</td>
                    <td className="py-3.5">
                      <span className="flex items-center gap-2.5">
                        {row.thumbnail_url || row.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.thumbnail_url || row.photo_url || ""} alt="" className="h-8 w-8 rounded-lg object-cover" />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f4f8fd] text-[#9aa3b2]"></span>
                        )}
                        <span className="text-[#3a4a66]">{row.product || "-"}</span>
                      </span>
                    </td>
                    <td className="py-3.5 font-semibold text-[#0f1c3f]">{money(row.total_amount)}</td>
                    <td className="py-3.5"><StatusPill status={row.status} /></td>
                    <td className="py-3.5 text-[#6b7587]">{clock(row.created_at)}</td>
                  </tr>
                ))}
                {!data?.recentOrders?.length ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[13px] text-[#8a94a6]">No orders yet. They will appear here as soon as customers check out.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside className="space-y-5">
        <Banner />

        <section className="rounded-[22px] bg-white p-4 shadow-[0_8px_30px_rgba(15,28,63,0.04)]">
          <h2 className="px-1 text-[16px] font-extrabold text-[#0f1c3f]">Quick Actions</h2>
          <ul className="mt-1">
            {actions.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="flex items-center gap-3 rounded-xl px-1 py-2.5 text-[14px] text-[#3a4a66] hover:bg-[#f7fafd]">
                  <span className="flex-1">{item.label}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c5d0e0" strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[22px] bg-white p-4 shadow-[0_8px_30px_rgba(15,28,63,0.04)]">
          <h2 className="px-1 text-[16px] font-extrabold text-[#0f1c3f]">Recent Activity</h2>
          <ul className="mt-3 space-y-3.5">
            {(data?.activity ?? []).slice(0, 4).map((item, i) => {
              const meta = activityMeta[item.kind] || activityMeta.user;
              return (
                <li key={`${item.at}-${i}`} className="flex gap-3 px-1">
                  <span aria-hidden className={`mt-[7px] h-2 w-2 shrink-0 rounded-full bg-current ${meta.color}`} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-[#0f1c3f]">{item.title}</p>
                    <p className="truncate text-[12.5px] text-[#6b7587]">{item.detail}</p>
                    <p className="mt-0.5 text-[11px] text-[#8a94a6]">{when(item.at)}</p>
                  </div>
                </li>
              );
            })}
            {!data?.activity?.length ? <li className="px-1 text-[13px] text-[#8a94a6]">No activity yet.</li> : null}
          </ul>
        </section>
      </aside>
    </div>
  );
}

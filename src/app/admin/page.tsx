"use client";

import Link from "next/link";
import { Caveat } from "next/font/google";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { clock, Donut, greeting, lastDays, LineChart, longDate, money, Sparkline, StatusPill, when } from "@/components/admin/admin-ui";

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
};

function Change({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <p className={`mt-2 flex items-center gap-1 text-[12.5px] font-medium ${up ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
      <span>{up ? "↑" : "↓"}</span> {Math.abs(value)}% <span className="font-normal text-[#8a94a6]">vs. last month</span>
    </p>
  );
}

const activityMeta: Record<string, { bg: string; color: string; d: string }> = {
  user: { bg: "bg-[#eaf1ff]", color: "text-[#2f6bff]", d: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 9c.6-3.5 3.2-5 7-5s6.4 1.5 7 5" },
  order: { bg: "bg-[#e7fbf4]", color: "text-[#12a37e]", d: "M6 6h15l-1.5 9h-12L5 3H2M7 20a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Zm9 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z" },
  product: { bg: "bg-[#fff6e5]", color: "text-[#d97706]", d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" },
  message: { bg: "bg-[#eaf1ff]", color: "text-[#2f6bff]", d: "M4 6h16v10H8l-4 4V6Z" },
  refund: { bg: "bg-[#fdecec]", color: "text-[#e5484d]", d: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5" },
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
          <rect x="122" y="18" width="14" height="58" rx="4" fill="#2f6bff" />
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

  useEffect(() => {
    accountApi<{ user: { firstName: string | null; displayName: string | null } }>("/api/v1/account")
      .then((b) => setName(b.user.firstName || b.user.displayName || "Admin"))
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
    { label: "Total Users", value: data?.stats.users.total ?? 0, change: data?.stats.users.change ?? 0, color: "#2f6bff", bg: "bg-[#eef4ff]", iconBg: "bg-[#d9e6ff] text-[#2f6bff]", spark: series.map((s) => s.users), icon: "M16 19c0-2.8-2.2-5-6-5s-6 2.2-6 5M10 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" },
    { label: "Total Orders", value: data?.stats.orders.total ?? 0, change: data?.stats.orders.change ?? 0, color: "#12a37e", bg: "bg-[#eafaf3]", iconBg: "bg-[#d6f5e8] text-[#0f9f76]", spark: series.map((s) => s.orders), icon: "M6 7h12l1.2 12H4.8L6 7Zm3-3h6l1 3H8l1-3Z" },
    { label: "Total Products", value: data?.stats.products.total ?? 0, change: data?.stats.products.change ?? 0, color: "#7c5cfc", bg: "bg-[#f4f0ff]", iconBg: "bg-[#e8e0ff] text-[#7c5cfc]", spark: series.map((s) => s.products), icon: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" },
    { label: "Total Revenue", value: data?.stats.revenue.total ?? 0, change: data?.stats.revenue.change ?? 0, color: "#2f6bff", bg: "bg-[#eef6ff]", iconBg: "bg-[#d9e6ff] text-[#2f6bff]", spark: series.map((s) => s.revenue), money: true, icon: "M12 3v18M8 8h5.2a2.8 2.8 0 0 1 0 5.6H9.2A2.8 2.8 0 0 0 9.2 19H16" },
  ];
  const os = data?.orderStatus ?? { completed: 0, processing: 0, pending: 0, cancelled: 0, total: 0 };
  const actions = [
    { href: "/admin/users?new=1", label: "Add New User", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6" },
    { href: "/admin/products", label: "Add Product", d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" },
    { href: "/admin/orders", label: "View Orders", d: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
    { href: "/admin/messages", label: "Send Message", d: "M4 6h16v10H8l-4 4V6Z" },
  ];

  return (
    <div className="grid gap-5 pb-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}

        <div>
          <p className="text-[16px] text-[#6b7587]">{greeting()},</p>
          <h1 className="mt-0.5 text-[34px] font-extrabold tracking-tight text-[#0f1c3f]">
            {name}! <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-[14.5px] text-[#6b7587]">Here&apos;s what&apos;s happening with your platform today.</p>
          <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-[#8a94a6]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="4" y="5" width="16" height="15" rx="2" />
              <path d="M8 3v4M16 3v4M4 10h16" />
            </svg>
            {longDate()}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((card) => (
            <section key={card.label} className={`rounded-[22px] ${card.bg} p-4`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-[13px] font-medium text-[#5b6780]">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${card.iconBg}`}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d={card.icon} />
                    </svg>
                  </span>
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
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#2f6bff]" /> Revenue</span>
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
                { name: "Revenue", color: "#2f6bff", values: series.map((s) => s.revenue), fill: true },
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
            <Link href="/admin/orders" className="text-[13px] font-medium text-[#2f6bff] hover:underline">View all →</Link>
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
                    <td className="py-3.5 font-semibold text-[#2f6bff]">#{row.order_number}</td>
                    <td className="py-3.5 text-[#0f1c3f]">{row.customer}</td>
                    <td className="py-3.5">
                      <span className="flex items-center gap-2.5">
                        {row.thumbnail_url || row.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.thumbnail_url || row.photo_url || ""} alt="" className="h-8 w-8 rounded-lg object-cover" />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5f8fc] text-[#9aa3b2]">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m8 14 2.5-3 2.5 3 3-4 3 4" /></svg>
                          </span>
                        )}
                        <span className="text-[#3a4a66]">{row.product || "—"}</span>
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
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-[#3a4a66]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={item.d} /></svg>
                  </span>
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
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.bg} ${meta.color}`}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={meta.d} /></svg>
                  </span>
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

"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Donut, LineChart, money } from "@/components/admin/admin-ui";

type Overview = {
  stats: {
    users: { total: number; change: number };
    orders: { total: number; change: number };
    products: { total: number; change: number };
    revenue: { total: number; change: number };
  };
  series: { day: string; users: number; orders: number; products: number; revenue: number }[];
  orderStatus: { completed: number; processing: number; pending: number; cancelled: number; total: number };
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accountApi<Overview>(`/api/v1/admin/overview?days=${days}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load analytics"));
  }, [days]);

  const series = data?.series ?? [];
  const labels = series.map((row) => {
    const d = new Date(row.day);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });
  const os = data?.orderStatus ?? { completed: 0, processing: 0, pending: 0, cancelled: 0, total: 0 };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Analytics</h1>
          <p className="text-[14px] text-[#6b7587]">Users, orders, listings, and revenue over time.</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-10 rounded-full border border-[#e2e8f0] px-3 text-[13px]">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Users", data?.stats.users.total ?? 0],
          ["Orders", data?.stats.orders.total ?? 0],
          ["Products", data?.stats.products.total ?? 0],
          ["Revenue", money(data?.stats.revenue.total ?? 0)],
        ].map(([label, value]) => (
          <section key={String(label)} className="rounded-[22px] border border-[#e7eef6] bg-white p-4">
            <p className="text-[13px] text-[#8a94a6]">{label}</p>
            <p className="mt-1 text-[24px] font-extrabold text-[#0f1c3f]">{value}</p>
          </section>
        ))}
      </div>
      <section className="rounded-[22px] border border-[#e7eef6] bg-white p-5">
        <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Revenue and orders</h2>
        <LineChart
          labels={labels}
          series={[
            { name: "Revenue", color: "#2f6bff", values: series.map((s) => s.revenue) },
            { name: "Orders", color: "#12a37e", values: series.map((s) => s.orders) },
            { name: "Users", color: "#7c5cfc", values: series.map((s) => s.users) },
          ]}
        />
      </section>
      <section className="rounded-[22px] border border-[#e7eef6] bg-white p-5">
        <h2 className="mb-4 text-[16px] font-extrabold text-[#0f1c3f]">Order mix</h2>
        <Donut
          total={os.total}
          segments={[
            { label: "Completed", value: os.completed, color: "#22c55e" },
            { label: "Processing", value: os.processing, color: "#3b82f6" },
            { label: "Pending", value: os.pending, color: "#f59e0b" },
            { label: "Cancelled", value: os.cancelled, color: "#ef4444" },
          ]}
        />
      </section>
    </div>
  );
}

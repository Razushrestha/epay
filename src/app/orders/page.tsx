"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { accountApi } from "@/lib/account-api";
import { BuyShell, StatusPill, money } from "@/components/commerce/BuyShell";

function OrdersContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<{ id: number; order_number: string; created_at: string; total_amount: number; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const success = searchParams?.get("success");

  useEffect(() => {
    const token = accountApi.getToken();
    if (!token) {
      window.location.href = "/login?redirect=/orders";
      return;
    }
    accountApi<{ data: typeof orders }>("/api/v1/orders")
      .then((body) => setOrders(body.data || []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <BuyShell
      crumbs={[
        { href: "/", label: "Home" },
        { label: "Orders" },
      ]}
      title={success ? "Payment received" : "Your orders"}
      body={
        success
          ? "Funds are in escrow until you confirm delivery. Track shipping, invoices, and returns here."
          : "Shipping, returns, invoices, and feedback — escrow on every paid order."
      }
      aside={
        <Link href="/search" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
          Continue shopping →
        </Link>
      }
    >
      {success ? (
        <p className="nexlo-alert nexlo-alert-ok mt-4">
          You can request a return within 30 days. Open the{" "}
          <Link href="/resolution" className="font-semibold underline">
            Resolution Center
          </Link>{" "}
          if something is wrong.
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-[14px] text-[#6b7587]">Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="nexlo-card mt-5 px-6 py-16 text-center">
          <h2 className="text-[18px] font-bold text-[#0f1c3f]">No orders yet</h2>
          <p className="mt-2 text-[14px] text-[#6b7587]">When you win an auction or check out, it will show up here.</p>
          <Link href="/search" className="nexlo-btn nexlo-btn-blue mt-5">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.order_number}`}
                className="nexlo-card flex flex-wrap items-center justify-between gap-3 p-4 hover:border-[#c9d8ff]"
              >
                <div>
                  <p className="text-[14px] font-bold text-[#0f1c3f]">Order {order.order_number}</p>
                  <p className="mt-0.5 text-[12.5px] text-[#6b7587]">
                    Placed{" "}
                    {new Date(order.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-[15px] font-extrabold text-[#0f1c3f]">{money(order.total_amount)}</p>
                    <div className="mt-1 flex justify-end">
                      <StatusPill status={order.status} />
                    </div>
                  </div>
                  <span className="text-[13px] font-semibold text-[#3665f3]">View →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BuyShell>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<main className="page-shell py-16 text-[14px] text-[#6b7587]">Loading orders…</main>}>
      <OrdersContent />
    </Suspense>
  );
}

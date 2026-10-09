"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { accountApi } from "@/lib/account-api";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";

function money(n: number) {
  return `NPR ${Number(n || 0).toLocaleString("en-NP")}`;
}

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
    <>
      <PageHero
        eyebrow="Your orders"
        title={success ? "Payment received. You're protected." : "Track every order in one place"}
        body={success
          ? "Funds are held in escrow until delivery. You can request a return within 30 days."
          : "Shipping, returns, invoices, and feedback — with the same buyer protection as the rest of Nexlo."}
        cta="Continue shopping"
        href="/shop"
      />
      <main className="page-shell py-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-[19px] font-bold text-[#191919]">Order history</h2>
            <p className="mt-[2px] text-[12px] text-[#707070]">Paid orders stay in escrow until you confirm delivery.</p>
          </div>
        </div>

        {loading ? (
          <p className="mt-8 text-[14px] text-[#707070]">Loading orders…</p>
        ) : orders.length === 0 ? (
          <div className="nexlo-card mt-6 px-6 py-12 text-center">
            <h3 className="text-[20px] font-bold text-[#191919]">No orders yet</h3>
            <p className="mt-2 text-[14px] text-[#707070]">When you win an auction or check out, it will show up here.</p>
            <Link href="/shop" className="nexlo-btn mt-5">Start shopping</Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link href={`/orders/${order.order_number}`} className="nexlo-card flex flex-wrap items-center justify-between gap-3 p-4 hover:shadow-md">
                  <div>
                    <p className="text-[14px] font-bold text-[#191919]">Order {order.order_number}</p>
                    <p className="mt-0.5 text-[12.5px] text-[#707070]">Placed {new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-bold text-[#191919]">{money(order.total_amount)}</p>
                    <p className="mt-0.5 text-[12px] font-semibold capitalize text-[#3665f3]">{String(order.status).replace(/_/g, " ")}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<main className="page-shell py-16 text-[14px] text-[#707070]">Loading orders…</main>}>
      <OrdersContent />
    </Suspense>
  );
}

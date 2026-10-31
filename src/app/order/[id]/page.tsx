"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { accountApi, getToken } from "@/lib/account-api";
import { BuyShell, StatusPill, money } from "@/components/commerce/BuyShell";

type Payment = {
  gateway: string | null;
  gateway_transaction_id: string | null;
  status: string | null;
  amount: number | string | null;
};

type OrderDetail = {
  order: {
    id: number;
    order_number: string;
    status: string;
    total_amount: number;
    items: { id: number; title: string; quantity: number; price: number }[];
  };
  payment?: Payment | null;
};

export default function OrderConfirmationPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refFromQuery, setRefFromQuery] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setRefFromQuery(q.get("ref"));
    if (!getToken()) {
      window.location.href = `/login?redirect=/order/${params.id}`;
      return;
    }
    accountApi<OrderDetail>(`/api/v1/orders/${params.id}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load order"));
  }, [params.id]);

  if (error) {
    return (
      <BuyShell crumbs={[{ href: "/", label: "Home" }, { href: "/orders", label: "Orders" }, { label: "Error" }]} title="Could not load this order" body={error}>
        <div className="nexlo-card mt-5 p-6">
          <Link href="/orders" className="nexlo-btn nexlo-btn-blue">
            Back to orders
          </Link>
        </div>
      </BuyShell>
    );
  }

  if (!data) {
    return (
      <BuyShell crumbs={[{ href: "/", label: "Home" }, { href: "/orders", label: "Orders" }]} title="Order" body="Loading confirmation…">
        <p className="mt-8 text-[14px] text-[#6b7587]">Loading confirmation…</p>
      </BuyShell>
    );
  }

  const paid = data.order.status === "paid" || data.payment?.status === "completed";
  const reference = refFromQuery || data.payment?.gateway_transaction_id;

  return (
    <BuyShell
      crumbs={[{ href: "/", label: "Home" }, { href: "/orders", label: "Orders" }, { label: data.order.order_number }]}
      title={paid ? "Payment confirmed" : `Order ${data.order.order_number}`}
      body={paid ? "Payment is held in escrow until delivery." : `${money(data.order.total_amount)} · Complete payment to place this order.`}
      aside={<StatusPill status={data.order.status} />}
    >
      {paid ? (
        <div role="alert" className="mt-5 rounded-xl border border-[#a7f3d0] bg-[#ecfdf5] px-4 py-3 text-[14px] font-semibold text-[#047857]">
          Payment completed. Transaction reference ID: {reference || "pending"}
        </div>
      ) : null}

      <section className="nexlo-card mt-5 p-5 sm:p-6">
        <h2 className="text-[16px] font-bold text-[#0f1c3f]">Order {data.order.order_number}</h2>
        <p className="mt-3 flex items-center justify-between text-[13px] text-[#6b7587]">
          Total
          <span className="text-[16px] font-extrabold text-[#0f1c3f]">{money(data.order.total_amount)}</span>
        </p>
        {reference ? (
          <p className="mt-2 flex items-center justify-between text-[13px] text-[#6b7587]">
            Transaction reference
            <span className="font-semibold text-[#0f1c3f]">{reference}</span>
          </p>
        ) : null}
        <ul className="mt-4 space-y-2">
          {(data.order.items || []).filter(Boolean).map((item) => (
            <li key={item.id} className="flex justify-between rounded-xl bg-[#f4f8fd] px-4 py-3 text-[14px] text-[#0f1c3f]">
              <span className="font-semibold">{item.title}</span>
              <span className="text-[13px] font-bold">
                × {item.quantity} · {money(item.price)}
              </span>
            </li>
          ))}
        </ul>
        <Link href={`/orders/${data.order.order_number}`} className="nexlo-btn nexlo-btn-blue mt-5 inline-flex">
          View order details
        </Link>
      </section>
    </BuyShell>
  );
}

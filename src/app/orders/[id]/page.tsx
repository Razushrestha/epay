"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { accountApi, getToken } from "@/lib/account-api";

const money = (n: number) => `NPR ${Number(n || 0).toLocaleString("en-NP")}`;

type OrderDetail = {
  order: {
    id: number;
    order_number: string;
    status: string;
    total_amount: number;
    created_at: string;
    shipping_name: string | null;
    shipping_address_line1?: string | null;
    buyer_id: number;
    items: { id: number; title: string; quantity: number; price: number; seller_id: number; tracking_number?: string | null; carrier?: string | null; listing_id?: number }[];
  };
  history: { status_to: string; notes: string | null; created_at: string }[];
  shipments: { carrier: string | null; tracking_number: string | null; status: string }[];
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("Nepal Post");
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [dsr, setDsr] = useState({ item: 5, comms: 5, ship: 5, cost: 5 });

  async function load() {
    if (!getToken()) {
      window.location.href = `/login?redirect=/orders/${params.id}`;
      return;
    }
    setData(await accountApi<OrderDetail>(`/api/v1/orders/${params.id}`));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load order"));
  }, [params.id]);

  if (error) return <main className="page-shell py-10 text-red-700">{error}</main>;
  if (!data) return <main className="page-shell py-10">Loading order…</main>;
  const order = data.order;

  return (
    <main className="min-h-screen bg-[#f5f8fc] py-8">
      <div className="page-shell space-y-4">
        <Link href="/orders" className="text-[13px] text-[#2f6bff]">← All orders</Link>
        <section className="rounded-2xl bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[24px] font-extrabold text-[#0f1c3f]">Order {order.order_number}</h1>
              <p className="mt-1 capitalize text-[14px] text-[#6b7587]">{order.status.replace(/_/g, " ")} · {money(order.total_amount)}</p>
            </div>
            <Link href={`/orders/${order.order_number}/invoice`} className="h-10 rounded-full border px-4 text-[14px] leading-10">VAT invoice</Link>
          </div>
          <ul className="mt-4 space-y-2 text-[14px]">
            {(order.items || []).filter(Boolean).map((item) => (
              <li key={item.id} className="rounded-xl bg-[#f5f8fc] px-4 py-3">
                {item.title} × {item.quantity} · {money(item.price)}
                {item.tracking_number ? <span className="block text-[12px] text-[#6b7587]">{item.carrier} {item.tracking_number}</span> : null}
              </li>
            ))}
          </ul>
        </section>

        {order.status === "pending_payment" ? (
          <section className="rounded-2xl bg-white p-6">
            <h2 className="font-bold">Pay now</h2>
            <p className="mt-1 text-[13px] text-[#6b7587]">Auction and Best Offer winners have 48 hours to pay. Funds are held in escrow until delivery.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["esewa", "khalti"] as const).map((gateway) => (
                <button
                  key={gateway}
                  type="button"
                  className="h-10 rounded-full bg-[#2f6bff] px-5 text-[14px] font-semibold capitalize text-white"
                  onClick={async () => {
                    const body = await accountApi<{ payment_url: string }>("/api/v1/payments/initiate", {
                      method: "POST",
                      body: JSON.stringify({ order_id: order.id, gateway }),
                    });
                    window.location.href = body.payment_url;
                  }}
                >
                  Pay with {gateway}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {["paid", "processing"].includes(order.status) ? (
          <form
            className="rounded-2xl bg-white p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              await accountApi(`/api/v1/orders/${order.id}/ship`, { method: "POST", body: JSON.stringify({ trackingNumber: tracking, carrier }) });
              await load();
            }}
          >
            <h2 className="font-bold">Mark shipped</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={carrier} onChange={(e) => setCarrier(e.target.value)} className="h-10 rounded-full border px-4" />
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking number" className="h-10 rounded-full border px-4" />
              <button className="h-10 rounded-full bg-[#121826] px-5 text-white">Ship</button>
            </div>
          </form>
        ) : null}

        {order.status === "shipped" ? (
          <button
            type="button"
            className="h-10 rounded-full bg-[#12a37e] px-5 text-white"
            onClick={async () => {
              await accountApi(`/api/v1/orders/${order.id}/deliver`, { method: "POST", body: "{}" });
              await load();
            }}
          >
            Confirm delivery
          </button>
        ) : null}

        {["delivered", "completed"].includes(order.status) ? (
          <form
            className="rounded-2xl bg-white p-6 space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await accountApi("/api/v1/feedback", {
                method: "POST",
                body: JSON.stringify({
                  orderId: order.id,
                  rating: stars,
                  comment,
                  dsrItem: dsr.item,
                  dsrCommunication: dsr.comms,
                  dsrShipping: dsr.ship,
                  dsrShippingCost: dsr.cost,
                }),
              });
              setError(null);
              await load();
            }}
          >
            <h2 className="font-bold">Leave feedback</h2>
            <select value={stars} onChange={(e) => setStars(Number(e.target.value))} className="h-10 rounded-full border px-3">
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
            </select>
            <div className="grid gap-2 sm:grid-cols-2 text-[13px]">
              {([["item", "Item as described"], ["comms", "Communication"], ["ship", "Shipping time"], ["cost", "Shipping cost"]] as const).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-2 rounded-xl bg-[#f5f8fc] px-3 py-2">
                  {label}
                  <input type="number" min={1} max={5} value={dsr[key]} onChange={(e) => setDsr({ ...dsr, [key]: Number(e.target.value) })} className="w-14 rounded border px-2" />
                </label>
              ))}
            </div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="min-h-20 w-full rounded-xl border px-3 py-2" placeholder="How did it go?" />
            <button className="h-10 rounded-full bg-[#2f6bff] px-5 text-white">Save feedback</button>
          </form>
        ) : null}

        {["pending_payment", "paid", "processing"].includes(order.status) ? (
          <button
            type="button"
            className="h-10 rounded-full border px-5"
            onClick={async () => {
              await accountApi(`/api/v1/orders/${order.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: "Cancelled by user" }) });
              await load();
            }}
          >
            Cancel order
          </button>
        ) : null}

        <section className="rounded-2xl bg-white p-6">
          <h2 className="font-bold">History</h2>
          <ul className="mt-2 space-y-1 text-[13px] text-[#5b6780]">
            {data.history.map((h, i) => (
              <li key={i}>{h.status_to} · {h.notes} · {new Date(h.created_at).toLocaleString()}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

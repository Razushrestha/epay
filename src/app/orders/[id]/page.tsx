"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { accountApi, getToken } from "@/lib/account-api";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";

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
  you?: { isBuyer: boolean; isSeller: boolean; isStaff: boolean };
  escrow?: { status: string; amount: number; released_at: string | null; net_to_seller: number | null } | null;
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
  const [actionError, setActionError] = useState<string | null>(null);

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

  if (error) {
    return (
      <>
        <main className="page-shell py-16 text-[14px] text-[#e53238]">{error}</main>
        <SiteFooter />
      </>
    );
  }
  if (!data) {
    return <main className="page-shell py-16 text-[14px] text-[#707070]">Loading order…</main>;
  }
  const order = data.order;

  return (
    <>
      <PageHero
        eyebrow={`Order ${order.order_number}`}
        title={order.status.replace(/_/g, " ")}
        body={`${money(order.total_amount)} · Escrow holds payment until the buyer confirms received, then funds move to the seller wallet for payout.`}
        cta="All orders"
        href="/orders"
      />
      <main className="page-shell space-y-4 py-8">
        {actionError ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{actionError}</p> : null}
        <section className="nexlo-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-bold text-[#191919]">Items</h2>
              <p className="mt-1 text-[13px] text-[#707070]">{order.shipping_name} {order.shipping_address_line1 ? `· ${order.shipping_address_line1}` : ""}</p>
            </div>
            <Link href={`/orders/${order.order_number}/invoice`} className="nexlo-link text-[13px]">VAT invoice →</Link>
          </div>
          <ul className="mt-4 space-y-2">
            {(order.items || []).filter(Boolean).map((item) => (
              <li key={item.id} className="rounded-xl bg-[#f7f7f7] px-4 py-3 text-[14px] text-[#191919]">
                {item.title} × {item.quantity} · {money(item.price)}
                {item.tracking_number ? <span className="mt-1 block text-[12px] text-[#707070]">{item.carrier} {item.tracking_number}</span> : null}
              </li>
            ))}
          </ul>
        </section>

        {order.status === "pending_payment" ? (
          <section className="nexlo-card p-5 sm:p-6">
            <h2 className="text-[19px] font-bold text-[#191919]">Pay now</h2>
            <p className="mt-1 text-[13px] text-[#707070]">Auction and Best Offer winners have 48 hours. Funds are held in escrow until delivery.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["esewa", "khalti"] as const).map((gateway) => (
                <button
                  key={gateway}
                  type="button"
                  className="nexlo-btn nexlo-btn-blue capitalize"
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

        {["paid", "processing"].includes(order.status) && (data.you?.isSeller || data.you?.isStaff) ? (
          <form
            className="nexlo-card p-5 sm:p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              setActionError(null);
              try {
                await accountApi(`/api/v1/orders/${order.id}/ship`, { method: "POST", body: JSON.stringify({ trackingNumber: tracking, carrier }) });
                await load();
              } catch (err) {
                setActionError(err instanceof Error ? err.message : "Could not mark shipped");
              }
            }}
          >
            <h2 className="text-[19px] font-bold text-[#191919]">Mark shipped</h2>
            <p className="mt-1 text-[13px] text-[#707070]">Buyer payment stays in escrow until they confirm received.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={carrier} onChange={(e) => setCarrier(e.target.value)} className="h-10 rounded-full border border-[#e7e7e7] px-4 text-[14px]" />
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking number" className="h-10 rounded-full border border-[#e7e7e7] px-4 text-[14px]" />
              <button className="nexlo-btn">Ship</button>
            </div>
          </form>
        ) : null}

        {["paid", "processing"].includes(order.status) && data.you?.isBuyer && !data.you?.isSeller ? (
          <section className="nexlo-card p-5 sm:p-6">
            <h2 className="text-[19px] font-bold text-[#191919]">Waiting on the seller</h2>
            <p className="mt-1 text-[13px] text-[#707070]">Your payment is in escrow. You can confirm received after this order ships.</p>
          </section>
        ) : null}

        {order.status === "shipped" && (data.you?.isBuyer || data.you?.isStaff) ? (
          <section className="nexlo-card p-5 sm:p-6">
            <h2 className="text-[19px] font-bold text-[#191919]">Confirm received</h2>
            <p className="mt-1 text-[13px] text-[#707070]">This releases escrow to the seller wallet so they can request a payout.</p>
            <button
              type="button"
              className="nexlo-btn mt-3"
              onClick={async () => {
                setActionError(null);
                try {
                  await accountApi(`/api/v1/orders/${order.id}/deliver`, { method: "POST", body: "{}" });
                  await load();
                } catch (err) {
                  setActionError(err instanceof Error ? err.message : "Could not confirm received");
                }
              }}
            >
              Confirm received
            </button>
          </section>
        ) : null}

        {order.status === "shipped" && data.you?.isSeller && !data.you?.isBuyer ? (
          <section className="nexlo-card p-5 sm:p-6">
            <h2 className="text-[19px] font-bold text-[#191919]">In transit</h2>
            <p className="mt-1 text-[13px] text-[#707070]">Escrow releases when the buyer confirms received.</p>
          </section>
        ) : null}

        {order.status === "completed" && data.escrow?.status === "released" ? (
          <section className="nexlo-card p-5 sm:p-6">
            <h2 className="text-[19px] font-bold text-[#191919]">Escrow released</h2>
            <p className="mt-1 text-[13px] text-[#707070]">
              {money(data.escrow.net_to_seller ?? data.escrow.amount)} is in the seller wallet and ready for payout.
            </p>
            {data.you?.isSeller ? (
              <Link href="/account?tab=selling" className="nexlo-link mt-3 inline-block text-[13px]">Open seller wallet →</Link>
            ) : null}
          </section>
        ) : null}

        {["delivered", "completed"].includes(order.status) ? (
          <form
            className="nexlo-card space-y-3 p-5 sm:p-6"
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
            <h2 className="text-[19px] font-bold text-[#191919]">Leave feedback</h2>
            <select value={stars} onChange={(e) => setStars(Number(e.target.value))} className="h-10 rounded-full border border-[#e7e7e7] px-3 text-[14px]">
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
            </select>
            <div className="grid gap-2 text-[13px] sm:grid-cols-2">
              {([["item", "Item as described"], ["comms", "Communication"], ["ship", "Shipping time"], ["cost", "Shipping cost"]] as const).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-2 rounded-xl bg-[#f7f7f7] px-3 py-2">
                  {label}
                  <input type="number" min={1} max={5} value={dsr[key]} onChange={(e) => setDsr({ ...dsr, [key]: Number(e.target.value) })} className="w-14 rounded border border-[#e7e7e7] px-2" />
                </label>
              ))}
            </div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="min-h-20 w-full rounded-xl border border-[#e7e7e7] px-3 py-2 text-[14px]" placeholder="How did it go?" />
            <button className="nexlo-btn nexlo-btn-blue">Save feedback</button>
          </form>
        ) : null}

        {["shipped", "delivered", "completed"].includes(order.status) ? (
          <form
            className="nexlo-card space-y-3 p-5 sm:p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              await accountApi("/api/v1/returns", {
                method: "POST",
                body: JSON.stringify({
                  orderId: order.id,
                  reason: form.get("reason"),
                  detail: form.get("detail"),
                  resolution: "refund",
                }),
              });
              window.location.href = "/account?tab=returns";
            }}
          >
            <h2 className="text-[19px] font-bold text-[#191919]">Request a return</h2>
            <p className="text-[13px] text-[#707070]">Not as described, damaged, or wrong item. Escrow stays frozen until the case is closed.</p>
            <select name="reason" className="h-10 rounded-full border border-[#e7e7e7] px-3 text-[14px]">
              <option value="not_as_described">Item not as described</option>
              <option value="damaged">Damaged</option>
              <option value="wrong_item">Wrong item</option>
              <option value="changed_mind">Changed mind</option>
              <option value="other">Other / not received</option>
            </select>
            <textarea name="detail" className="min-h-20 w-full rounded-xl border border-[#e7e7e7] px-3 py-2 text-[14px]" placeholder="What happened?" />
            <button className="h-10 rounded-full border border-[#3665f3] px-5 text-[13.5px] font-semibold text-[#3665f3]">Open return</button>
          </form>
        ) : null}

        {["pending_payment", "paid", "processing"].includes(order.status) ? (
          <button
            type="button"
            className="h-10 rounded-full border border-[#e7e7e7] px-5 text-[13.5px] font-semibold text-[#191919]"
            onClick={async () => {
              await accountApi(`/api/v1/orders/${order.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: "Cancelled by user" }) });
              await load();
            }}
          >
            Cancel order
          </button>
        ) : null}

        <section className="nexlo-card p-5 sm:p-6">
          <h2 className="text-[19px] font-bold text-[#191919]">History</h2>
          <ul className="mt-3 space-y-2 text-[13px] text-[#707070]">
            {data.history.map((h, i) => (
              <li key={i}>{h.status_to.replace(/_/g, " ")} · {h.notes} · {new Date(h.created_at).toLocaleString()}</li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

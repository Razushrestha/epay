"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { accountApi, getToken } from "@/lib/account-api";

const money = (n: number) => `NPR ${Number(n || 0).toLocaleString("en-NP")}`;

export default function InvoicePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<{
    order: { order_number: string; total_amount: number; created_at: string; shipping_name: string | null; items: { title: string; quantity: number; price: number }[] };
    fees: { commission: number; final_value_fee: number; insertion_fee: number; processing_fee: number; net_to_seller: number } | null;
    invoiceNumber: string;
    pdf_base64?: string;
  } | null>(null);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = `/login?redirect=/orders/${params.id}/invoice`;
      return;
    }
    accountApi<NonNullable<typeof data>>(`/api/v1/orders/${params.id}/invoice`).then(setData).catch(() => undefined);
  }, [params.id]);

  if (!data) return <main className="p-10">Loading invoice…</main>;

  return (
    <main className="mx-auto max-w-3xl bg-white p-10 print:p-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#191919]">Nexlo VAT invoice</h1>
          <p className="text-sm text-[#707070]">{data.invoiceNumber}</p>
        </div>
          <div className="flex gap-2 print:hidden">
            <button type="button" onClick={() => window.print()} className="nexlo-btn nexlo-btn-blue">Print</button>
            {data.pdf_base64 ? (
              <button
                type="button"
                className="nexlo-btn"
                onClick={() => {
                  const bytes = Uint8Array.from(atob(data.pdf_base64 || ""), (c) => c.charCodeAt(0));
                  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${data.invoiceNumber}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download PDF
              </button>
            ) : null}
          </div>
      </div>
      <p className="mt-4 text-sm">Bill to: {data.order.shipping_name || "Customer"}</p>
      <p className="text-sm">Order {data.order.order_number} · {new Date(data.order.created_at).toLocaleDateString()}</p>
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b"><th className="py-2">Item</th><th>Qty</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {(data.order.items || []).filter(Boolean).map((item, i) => (
            <tr key={i} className="border-b">
              <td className="py-2">{item.title}</td>
              <td>{item.quantity}</td>
              <td>{money(item.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-right font-bold">Total {money(data.order.total_amount)}</p>
      {data.fees ? (
        <div className="mt-6 text-sm text-[#5b6780]">
          <p>Commission {money(data.fees.commission)}</p>
          <p>Final value fee {money(data.fees.final_value_fee)}</p>
          <p>Processing {money(data.fees.processing_fee)}</p>
          <p>Net to seller {money(data.fees.net_to_seller)}</p>
        </div>
      ) : null}
      <p className="mt-8 text-xs text-[#8a94a6]">Nexlo holds buyer funds in escrow until delivery. VAT invoice for Nepal marketplace sales.</p>
    </main>
  );
}

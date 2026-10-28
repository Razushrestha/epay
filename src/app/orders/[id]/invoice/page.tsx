"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { accountApi, getToken } from "@/lib/account-api";
import { money } from "@/components/commerce/BuyShell";

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

  if (!data) {
    return <main className="page-shell py-16 text-[14px] text-[#6b7587]">Loading invoice…</main>;
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] print:bg-white">
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-0 sm:py-10 print:max-w-none print:p-0">
        <p className="mb-4 text-[12.5px] text-[#98a2b3] print:hidden">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span className="mx-1.5">›</span>
          <Link href="/orders" className="hover:underline">
            Orders
          </Link>
          <span className="mx-1.5">›</span>
          <Link href={`/orders/${params.id}`} className="hover:underline">
            {data.order.order_number}
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-[#667085]">Invoice</span>
        </p>

        <div className="nexlo-card p-6 sm:p-10 print:border-0 print:p-0 print:shadow-none">
          <div className="flex items-start justify-between gap-4 border-b border-[#e7eef6] pb-5">
            <div>
              <Image src="/logo-transparent.png" alt="Nexlo" width={808} height={256} className="h-10 w-auto" />
              <h1 className="mt-4 text-[22px] font-extrabold text-[#0f1c3f]">VAT invoice</h1>
              <p className="mt-0.5 text-[13px] text-[#6b7587]">{data.invoiceNumber}</p>
            </div>
            <div className="flex gap-2 print:hidden">
              <button type="button" onClick={() => window.print()} className="nexlo-btn nexlo-btn-blue">
                Print
              </button>
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
          <p className="mt-5 text-[14px] text-[#0f1c3f]">Bill to: {data.order.shipping_name || "Customer"}</p>
          <p className="text-[13px] text-[#6b7587]">
            Order {data.order.order_number} · {new Date(data.order.created_at).toLocaleDateString()}
          </p>
          <table className="mt-6 w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#e7eef6] text-[12px] uppercase tracking-wide text-[#6b7587]">
                <th className="py-2 font-semibold">Item</th>
                <th className="font-semibold">Qty</th>
                <th className="font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(data.order.items || []).filter(Boolean).map((item, i) => (
                <tr key={i} className="border-b border-[#e7eef6] text-[#0f1c3f]">
                  <td className="py-3">{item.title}</td>
                  <td>{item.quantity}</td>
                  <td>{money(item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-5 text-right text-[16px] font-extrabold text-[#0f1c3f]">Total {money(data.order.total_amount)}</p>
          {data.fees ? (
            <div className="mt-6 rounded-2xl border border-[#e7eef6] bg-[#f4f8fd] p-4 text-[13px] text-[#5b6780]">
              <p>Commission {money(data.fees.commission)}</p>
              <p>Final value fee {money(data.fees.final_value_fee)}</p>
              <p>Processing {money(data.fees.processing_fee)}</p>
              <p className="mt-1 font-semibold text-[#0f1c3f]">Net to seller {money(data.fees.net_to_seller)}</p>
            </div>
          ) : null}
          <p className="mt-8 text-[12px] text-[#8a94a6]">Nexlo holds buyer funds in escrow until delivery. VAT invoice for Nepal marketplace sales.</p>
        </div>
      </main>
    </div>
  );
}

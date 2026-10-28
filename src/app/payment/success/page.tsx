import Link from "next/link";
import { BuyShell } from "@/components/commerce/BuyShell";

export default function PaymentSuccessPage() {
  return (
    <BuyShell
      crumbs={[
        { href: "/", label: "Home" },
        { href: "/orders", label: "Orders" },
        { label: "Payment" },
      ]}
      title="Payment received"
      body="Funds are held in escrow until delivery. Track shipping, leave feedback, or open a return from your orders."
    >
      <div className="mx-auto mt-6 max-w-xl">
        <div className="nexlo-card p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f8ee] text-[#159947]" aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="m5 12 5 5L20 7" />
            </svg>
          </span>
          <p className="mt-4 text-[14px] leading-relaxed text-[#6b7587]">
            You will get an email when the seller ships.{" "}
            <Link href="/buyer-protection" className="font-semibold text-[#3665f3] hover:underline">
              Buyer Protection
            </Link>{" "}
            lasts 30 days after delivery.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/orders?success=1" className="nexlo-btn nexlo-btn-blue">
              Go to orders
            </Link>
            <Link href="/resolution" className="nexlo-btn nexlo-btn-ghost">
              Resolution Center
            </Link>
            <Link href="/search" className="nexlo-link text-[13.5px] leading-10">
              Keep shopping →
            </Link>
          </div>
        </div>
      </div>
    </BuyShell>
  );
}

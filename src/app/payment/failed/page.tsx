import Link from "next/link";
import { BuyShell } from "@/components/commerce/BuyShell";

export default function PaymentFailedPage() {
  return (
    <BuyShell
      crumbs={[
        { href: "/", label: "Home" },
        { href: "/cart", label: "Cart" },
        { label: "Payment" },
      ]}
      title="Payment could not be completed"
      body="Nothing was charged. Return to your cart and try eSewa or Khalti again."
    >
      <div className="mx-auto mt-6 max-w-xl">
        <div className="nexlo-card p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff5f5] text-[#b42318]" aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </span>
          <p className="mt-4 text-[14px] leading-relaxed text-[#6b7587]">
            Your order is still unpaid. Escrow only holds funds after a successful payment. If this keeps happening, open a help ticket.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/cart" className="nexlo-btn nexlo-btn-blue">
              Back to cart
            </Link>
            <Link href="/search" className="nexlo-btn nexlo-btn-ghost">
              Continue shopping
            </Link>
            <Link href="/help" className="nexlo-link text-[13.5px] leading-10">
              Help centre →
            </Link>
          </div>
        </div>
      </div>
    </BuyShell>
  );
}

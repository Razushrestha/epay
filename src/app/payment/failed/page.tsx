import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";

export default function PaymentFailedPage() {
  return (
    <>
      <PageHero
        eyebrow="Payment"
        title="Payment could not be completed"
        body="Nothing was charged. Return to your cart and try eSewa or Khalti again, or open a help ticket if the issue repeats."
        cta="Back to cart"
        href="/cart"
      />
      <main className="page-shell py-8">
        <div className="nexlo-card mx-auto max-w-xl p-8 text-center">
          <p className="text-[14px] text-[#707070]">Your order is still unpaid. Escrow only holds funds after a successful payment.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/cart" className="nexlo-btn">
              Back to cart
            </Link>
            <Link href="/search" className="h-10 rounded-full border border-[#e7e7e7] px-5 text-[13.5px] font-semibold leading-10 text-[#191919]">
              Continue shopping
            </Link>
            <Link href="/help" className="nexlo-link text-[13.5px] leading-10">
              Help centre →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

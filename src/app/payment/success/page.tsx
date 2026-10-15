import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";

export default function PaymentSuccessPage() {
  return (
    <>
      <PageHero
        eyebrow="Payment"
        title="Payment received"
        body="Funds are held in escrow until delivery. Track shipping, leave feedback, or open a return from your orders."
        cta="View orders"
        href="/orders"
      />
      <main className="page-shell py-8">
        <div className="nexlo-card mx-auto max-w-xl p-8 text-center">
          <p className="text-[14px] text-[#6b7587]">You will get an email when the seller ships. <Link href="/buyer-protection" className="font-semibold text-[#3665f3]">Buyer Protection</Link> lasts 30 days after delivery.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/orders" className="nexlo-btn nexlo-btn-blue">Go to orders</Link>
            <Link href="/resolution" className="nexlo-btn nexlo-btn-ghost">
              Resolution Center
            </Link>
            <Link href="/shop" className="nexlo-link text-[13.5px] leading-10">
              Keep shopping →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

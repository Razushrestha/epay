import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export default function CartPage() {
  return (
    <>
      <main className="mx-auto max-w-[900px] px-4 py-10">
        <h1 className="text-[22px] font-bold text-[#191919]">Your cart</h1>
        <div className="mt-6 rounded-2xl border border-dashed border-[#ddd] bg-white px-6 py-16 text-center">
          <p className="text-[16px] font-semibold text-[#191919]">Your cart is empty</p>
          <p className="mt-2 text-[13px] text-[#707070]">
            Items you add from listings will show up here for checkout.
          </p>
          <Link href="/deals" className="mt-5 inline-block rounded-full bg-[#3665f3] px-6 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#2953c6]">
            Browse deals
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

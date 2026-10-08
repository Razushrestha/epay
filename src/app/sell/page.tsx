import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export default function SellPage() {
  return (
    <>
      <main className="page-shell py-6">
        <div id="list" className="mx-auto max-w-[760px] scroll-mt-24">
          <h1 className="text-[24px] font-bold text-[#191919]">Sell on Nexlo</h1>
        <p className="mt-2 text-[14px] text-[#555]">
          List as an auction, Buy It Now, or Best Offer. Photos, category and price come next.
        </p>
        <form className="mt-6 space-y-4 rounded-2xl border border-[#e7e7e7] bg-white p-6">
          <label className="block text-[13px] font-medium">
            Title
            <input className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#3665f3]" placeholder="What are you selling?" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-[13px] font-medium">
              Format
              <select className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none">
                <option>Auction</option>
                <option>Buy It Now</option>
                <option>Best Offer</option>
              </select>
            </label>
            <label className="block text-[13px] font-medium">
              Price (NPR)
              <input className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none" placeholder="0" />
            </label>
          </div>
          <label className="block text-[13px] font-medium">
            Category
            <select className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none">
              <option>Electronics</option>
              <option>Fashion</option>
              <option>Motors</option>
              <option>Home & Garden</option>
              <option>Collectibles & Art</option>
            </select>
          </label>
          <label className="block text-[13px] font-medium">
            Description
            <textarea rows={4} className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none" placeholder="Condition, what’s included, shipping notes" />
          </label>
          <button type="button" className="rounded-full bg-[#3665f3] px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-[#2953c6]">
            Save draft
          </button>
          <p className="text-[12px] text-[#707070]">
            Seller KYC is required before a listing goes live.{" "}
            <Link href="/register" className="text-[#3665f3] hover:underline">Create an account</Link>
          </p>
        </form>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

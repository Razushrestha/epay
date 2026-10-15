"use client";

import Link from "next/link";
import { LiveDeals } from "@/components/home/LiveDeals";

export function DealsRow() {
  return (
    <section className="page-shell pt-7">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[20px] font-extrabold text-[#0f1c3f]">Today&apos;s Deals</h2>
          <p className="mt-[2px] text-[12px] text-[#6b7587]">Live listings with a compare-at price, featured, or promoted.</p>
        </div>
        <Link href="/deals" className="shrink-0 text-[12.5px] text-[#3665f3] hover:underline">
          View all deals →
        </Link>
      </div>
      <LiveDeals compact limit={6} />
    </section>
  );
}

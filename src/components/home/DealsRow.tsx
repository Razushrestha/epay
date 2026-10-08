import Image from "next/image";
import Link from "next/link";
import { todaysDeals } from "@/lib/home-data";

export function DealsRow() {
  return (
    <section className="page-shell pt-7">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[19px] font-bold text-[#191919]">Today&apos;s Deals</h2>
          <p className="mt-[2px] text-[12px] text-[#707070]">
            Limited-time offers. Don&apos;t miss out!
          </p>
        </div>
        <Link href="/deals" className="shrink-0 text-[12.5px] text-[#3665f3] hover:underline">
          View all deals →
        </Link>
      </div>

      <div className="no-scrollbar mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {todaysDeals.map((deal) => (
          <Link
            key={deal.id}
            href={`/listing/${deal.id}`}
            className="group overflow-hidden rounded-xl border border-[#e7e7e7] bg-white hover:shadow-md"
          >
            <span className="relative block bg-[#f7f7f7]">
              <Image
                src={deal.img}
                alt={deal.title}
                width={340}
                height={260}
                className="aspect-[17/13] w-full object-cover"
                loading="lazy"
              />
              <span className="absolute left-2 top-2 rounded bg-[#e53238] px-1.5 py-[2px] text-[10px] font-bold text-white">
                {deal.off}
              </span>
              <span
                aria-label="Add to watchlist"
                className="absolute right-2 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[16px] text-[#333] shadow-sm"
              >
                ♡
              </span>
            </span>
            <span className="block p-2.5">
              <span className="clamp-2 block min-h-[32px] text-[12.5px] font-medium leading-snug text-[#191919]">
                {deal.title}
              </span>
              <span className="mt-1.5 block text-[15px] font-bold text-[#191919]">
                {deal.price}
              </span>
              <span className="mt-[2px] block text-[11px]">
                <span className="text-[#707070] line-through">{deal.was}</span>
                <span className="ml-1.5 font-semibold text-[#008638]">{deal.off}</span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

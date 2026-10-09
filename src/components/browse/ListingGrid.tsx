import Image from "next/image";
import Link from "next/link";
import type { Listing } from "@/lib/home-data";
import { SaveButton } from "@/components/commerce/SaveButton";

export function ListingGrid({ items }: { items: Listing[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#ddd] bg-white px-6 py-16 text-center text-[14px] text-[#707070]">
        No listings match these filters yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.id} className="group relative overflow-hidden rounded-xl border border-[#e7e7e7] bg-white hover:shadow-md">
          <Link href={`/listing/${item.id}`} className="block">
            <span className="relative block bg-[#f7f7f7]">
              <Image
                src={item.img}
                alt={item.title}
                width={400}
                height={300}
                className="aspect-[4/3] w-full object-cover"
              />
              {item.off && (
                <span className="absolute left-2 top-2 rounded bg-[#e53238] px-1.5 py-[2px] text-[10px] font-bold text-white">
                  {item.off}
                </span>
              )}
            </span>
            <span className="block p-2.5">
              <span className="clamp-2 block min-h-[32px] text-[13px] font-medium leading-snug text-[#191919]">
                {item.title}
              </span>
              <span className="mt-1.5 block text-[15px] font-bold text-[#191919]">{item.price}</span>
              {item.was && (
                <span className="mt-[2px] block text-[11px]">
                  <span className="text-[#707070] line-through">{item.was}</span>
                  {item.off && <span className="ml-1.5 font-semibold text-[#008638]">{item.off}</span>}
                </span>
              )}
              <span className="mt-1 block text-[11.5px] text-[#555]">
                {item.format === "auction"
                  ? `${item.bids ?? 0} bids · ${item.timeLeft}`
                  : "Buy It Now"}
                {" · "}
                {item.shipping}
              </span>
            </span>
          </Link>
          <SaveButton
            listingId={item.id}
            title={item.title}
            photo={item.img}
            price={item.price}
            className="absolute right-2 top-1.5 z-10"
          />
        </article>
      ))}
    </div>
  );
}

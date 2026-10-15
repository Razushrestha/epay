import Image from "next/image";
import Link from "next/link";
import type { Listing } from "@/lib/home-data";
import { SaveButton } from "@/components/commerce/SaveButton";

export function ListingGrid({ items }: { items: Listing[] }) {
  if (items.length === 0) {
    return (
      <p className="nexlo-card px-6 py-16 text-center text-[14px] text-[#6b7587]">
        No listings match these filters yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.id} className="nexlo-card group relative overflow-hidden transition hover:border-[#c9d8ff]">
          <Link href={`/listing/${item.id}`} className="block">
            <span className="relative block bg-[#f4f8fd]">
              <Image
                src={item.img}
                alt={item.title}
                width={400}
                height={300}
                className="aspect-[4/3] w-full object-cover"
              />
              {item.off && (
                <span className="absolute left-2 top-2 rounded-full bg-[#e53238] px-2 py-[3px] text-[10px] font-bold text-white">
                  {item.off}
                </span>
              )}
            </span>
            <span className="block p-3">
              <span className="clamp-2 block min-h-[36px] text-[13px] font-medium leading-snug text-[#0f1c3f]">
                {item.title}
              </span>
              <span className="mt-1.5 block text-[16px] font-extrabold text-[#0f1c3f]">{item.price}</span>
              {item.was && (
                <span className="mt-[2px] block text-[11px]">
                  <span className="text-[#8a94a6] line-through">{item.was}</span>
                  {item.off && <span className="ml-1.5 font-semibold text-[#0f7a63]">{item.off}</span>}
                </span>
              )}
              <span className="mt-1 block text-[11.5px] text-[#6b7587]">
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

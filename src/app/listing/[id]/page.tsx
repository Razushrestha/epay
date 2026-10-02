import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { listings } from "@/lib/home-data";

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = listings.find((l) => l.id === Number(id));
  if (!item) notFound();

  return (
    <>
      <main className="mx-auto max-w-[1100px] px-4 py-6">
        <p className="text-[12px] text-[#707070]">
          <Link href="/" className="hover:underline">Home</Link>
          <span className="mx-1.5">›</span>
          <Link href={`/categories/${item.category}`} className="capitalize hover:underline">
            {item.category.replace(/-/g, " ")}
          </Link>
        </p>
        <div className="mt-4 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-2xl border border-[#e7e7e7] bg-[#f7f7f7]">
            <Image src={item.img} alt={item.title} width={900} height={700} className="aspect-[4/3] w-full object-cover" priority />
          </div>
          <div>
            <h1 className="text-[22px] font-bold leading-snug text-[#191919]">{item.title}</h1>
            <p className="mt-2 text-[13px] text-[#555]">
              Condition: {item.condition} · {item.shipping}
            </p>
            <p className="mt-4 text-[28px] font-bold text-[#191919]">{item.price}</p>
            {item.was && (
              <p className="text-[13px] text-[#707070]">
                <span className="line-through">{item.was}</span>
                {item.off && <span className="ml-2 font-semibold text-[#008638]">{item.off}</span>}
              </p>
            )}
            {item.format === "auction" && (
              <p className="mt-2 text-[13px] text-[#333]">
                {item.bids} bids · Ends in {item.timeLeft}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-2">
              {item.format === "auction" ? (
                <Link href="/cart" className="rounded-full bg-[#3665f3] py-3 text-center text-[14px] font-semibold text-white hover:bg-[#2953c6]">
                  Place bid
                </Link>
              ) : (
                <Link href="/cart" className="rounded-full bg-[#3665f3] py-3 text-center text-[14px] font-semibold text-white hover:bg-[#2953c6]">
                  Buy It Now
                </Link>
              )}
              <Link href="/cart" className="rounded-full border border-[#191919] py-3 text-center text-[14px] font-semibold hover:bg-[#f6f6f6]">
                Add to cart
              </Link>
              <Link href="/watchlist" className="rounded-full border border-[#ddd] py-3 text-center text-[14px] font-medium hover:bg-[#f6f6f6]">
                Add to watchlist
              </Link>
            </div>
            <ul className="mt-6 space-y-2 text-[12.5px] text-[#333]">
              <li>Buyer protection & secure payments</li>
              <li>30-day returns on eligible items</li>
              <li>Ships from Nepal · NPR pricing</li>
            </ul>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

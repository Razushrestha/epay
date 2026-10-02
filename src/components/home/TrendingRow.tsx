import Image from "next/image";
import Link from "next/link";
import { trending } from "@/lib/home-data";

export function TrendingRow() {
  return (
    <section className="page-shell pt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] font-bold tracking-tight text-[#1a2744]">Trending on Nexlo</h2>
        <Link href="/deals" className="text-[13.5px] font-medium text-[#3665f3] hover:underline">
          View all →
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8 xl:gap-3.5">
        {trending.map((item) => (
          <Link key={item.name} href={item.href} className="group flex min-w-0 flex-col">
            <span className="relative aspect-square w-full overflow-hidden rounded-[16px] bg-[#f3f5f8] transition group-hover:bg-[#eef1f6]">
              <Image
                src={item.img}
                alt={item.name}
                fill
                sizes="(min-width: 1280px) 12vw, 40vw"
                className="object-contain p-3.5 transition duration-300 group-hover:scale-[1.03]"
              />
            </span>
            <span className="mt-2.5 h-10 text-center text-[13px] leading-snug text-[#5f6976]">
              {item.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

import Image from "next/image";
import Link from "next/link";
import { shopCategories } from "@/lib/home-data";

export function CategoryGrid() {
  return (
    <section className="page-shell pt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] font-bold tracking-tight text-[#1a2744]">
          Shop by category
        </h2>
        <Link
          href="/categories/electronics"
          className="text-[13.5px] font-medium text-[#3665f3] hover:underline"
        >
          View all →
        </Link>
      </div>
      <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-8 lg:gap-3.5 lg:overflow-visible">
        {shopCategories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/categories/${cat.slug}`}
            className="group flex w-[168px] shrink-0 flex-col rounded-[18px] lg:w-auto"
            style={{ backgroundColor: cat.bg }}
          >
            <span className="flex h-[132px] items-center justify-center px-3 pt-3">
              <Image
                src={cat.img}
                alt={cat.name}
                width={240}
                height={180}
                className="h-[112px] w-full object-contain transition duration-300 group-hover:scale-[1.04]"
              />
            </span>
            <span className="mt-auto flex items-center justify-between gap-2 px-3 pb-3 pt-1">
              <span className="text-[12.5px] font-medium leading-tight text-[#24324d]">
                {cat.name}
              </span>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-[14px] text-[#24324d] shadow-sm">
                ›
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

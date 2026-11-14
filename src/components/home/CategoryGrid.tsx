import Link from "next/link";
import { categorySearchHref, fetchLevel1Categories } from "@/lib/catalog";

const tints = ["#eef3fb", "#f6f1ec", "#f4eef6", "#eef2f6", "#f7f4ef", "#f8eef1", "#eef1f4", "#f8eef2", "#f1f6ee", "#f3f0ea"];

/** Shows the live top-level categories managed in Admin → Catalog. */
export async function CategoryGrid() {
  const live = await fetchLevel1Categories().catch(() => []);
  if (!live.length) return null;

  return (
    <section className="page-shell pt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] font-extrabold tracking-tight text-[#0f1c3f]">
          Shop by category
        </h2>
        <Link
          href="/search"
          className="text-[13.5px] font-medium text-[#3665f3] hover:underline"
        >
          View all →
        </Link>
      </div>
      <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible">
        {live.map((cat, index) => (
          <Link
            key={cat.id}
            href={categorySearchHref(cat.id)}
            className="group flex w-[168px] shrink-0 flex-col rounded-[18px] lg:w-auto"
            style={{ backgroundColor: tints[index % tints.length] }}
          >
            <span
              className="flex h-[112px] items-center justify-center px-3 pt-3 text-[56px] leading-none transition duration-300 group-hover:scale-[1.06]"
              aria-hidden
            >
              {cat.icon || "🗂️"}
            </span>
            <span className="mt-auto flex items-center justify-between gap-2 px-3 pb-3 pt-1">
              <span className="text-[13px] font-medium leading-tight text-[#24324d]">{cat.name}</span>
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

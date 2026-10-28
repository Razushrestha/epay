import Link from "next/link";
import { ListingGrid } from "@/components/browse/ListingGrid";
import { SiteFooter } from "@/components/SiteFooter";
import { categoryNames, listings } from "@/lib/home-data";

export function BrowsePage({
  title,
  crumb,
  items,
  subtitle,
}: {
  title: string;
  crumb: string;
  items: typeof listings;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <main className="page-shell py-5">
        <p className="text-[12.5px] text-[#98a2b3]">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-[#667085]">{crumb}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-[#0f1c3f] sm:text-[30px]">{title}</h1>
            <p className="mt-1 text-[13px] text-[#6b7587]">
              {subtitle ?? `${items.length.toLocaleString()} results · Same buyer protection as the rest of Nexlo.`}
            </p>
          </div>
          <Link href="/search" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
            Live listings →
          </Link>
        </div>
        <div className="mt-5">
          <ListingGrid items={items} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function titleForSlug(slug: string) {
  return categoryNames[slug] ?? slug.replace(/-/g, " ");
}

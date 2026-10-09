import Link from "next/link";
import { ListingGrid } from "@/components/browse/ListingGrid";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";
import { categoryNames, listings } from "@/lib/home-data";

const formats = ["All", "Auction", "Buy It Now"];
const sorts = ["Best Match", "Price: low", "Price: high", "Ending soonest", "Newly listed"];

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
    <>
      <PageHero
        eyebrow={crumb}
        title={title}
        body={subtitle ?? `${items.length.toLocaleString()} results · Same buyer protection as the rest of Nexlo.`}
        cta="Live listings"
        href="/search"
      />
      <main className="page-shell py-5">
        <p className="text-[12px] text-[#707070]">
          <Link href="/" className="hover:underline">Home</Link>
          <span className="mx-1.5">›</span>
          <span className="text-[#191919]">{crumb}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] text-[#707070]">{items.length.toLocaleString()} listings</p>
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-[#333]">
            Sort
            <select className="h-9 rounded-full border border-[#ccc] bg-white px-3 text-[12.5px] outline-none">
              {sorts.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="h-fit rounded-xl border border-[#e7e7e7] bg-white p-4 text-[13px]">
            <p className="font-bold text-[#191919]">Format</p>
            <ul className="mt-2 space-y-1.5 text-[#333]">
              {formats.map((f) => (
                <li key={f}>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="format" defaultChecked={f === "All"} />
                    {f}
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-5 font-bold text-[#191919]">Condition</p>
            <ul className="mt-2 space-y-1.5 text-[#333]">
              {["New", "Used", "Refurbished"].map((c) => (
                <li key={c}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" />
                    {c}
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-5 font-bold text-[#191919]">Price (NPR)</p>
            <div className="mt-2 flex gap-2">
              <input placeholder="Min" className="w-full rounded-lg border border-[#ddd] px-2 py-1.5 text-[12px] outline-none" />
              <input placeholder="Max" className="w-full rounded-lg border border-[#ddd] px-2 py-1.5 text-[12px] outline-none" />
            </div>
            <label className="mt-4 flex items-center gap-2 text-[#333]">
              <input type="checkbox" /> Free shipping
            </label>
          </aside>
          <ListingGrid items={items} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export function titleForSlug(slug: string) {
  return categoryNames[slug] ?? slug.replace(/-/g, " ");
}

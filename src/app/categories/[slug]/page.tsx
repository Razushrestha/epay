import { redirect } from "next/navigation";
import { CategoryBrowse } from "@/components/browse/ElectronicsBrowse";
import { SiteFooter } from "@/components/SiteFooter";
import { categoryBrowse } from "@/lib/category-catalogs";
import { categoryAliases, categoryNames } from "@/lib/home-data";
import { categorySearchHref, fetchLevel1Categories } from "@/lib/catalog";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const key = categoryAliases[slug] ?? slug;

  const browse = categoryBrowse[key];
  if (browse) {
    return (
      <>
        <CategoryBrowse key={key} config={browse} />
        <SiteFooter />
      </>
    );
  }

  if (slug === "deals" || key === "deals") redirect("/deals");
  if (slug === "saved") redirect("/watchlist");

  const title = categoryNames[slug] ?? categoryNames[key] ?? slug.replace(/-/g, " ");
  const cats = await fetchLevel1Categories().catch(() => []);
  const match = cats.find(
    (cat) =>
      cat.slug === slug ||
      cat.slug === key ||
      cat.name.toLowerCase() === title.toLowerCase(),
  );
  if (match) redirect(categorySearchHref(match.id));
  redirect(`/search?q=${encodeURIComponent(title)}`);
}

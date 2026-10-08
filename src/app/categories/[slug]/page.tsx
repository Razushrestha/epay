import { BrowsePage, titleForSlug } from "@/components/browse/BrowsePage";
import { CategoryBrowse } from "@/components/browse/ElectronicsBrowse";
import { SiteFooter } from "@/components/SiteFooter";
import { categoryBrowse } from "@/lib/category-catalogs";
import { categoryAliases, listings } from "@/lib/home-data";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const key = categoryAliases[slug] ?? slug;
  const items = listings.filter((l) => l.category === key);
  const title = titleForSlug(slug);

  const results = items.length > 0 ? items : listings;

  const browse = categoryBrowse[key];
  if (browse) {
    return (
      <>
        <CategoryBrowse key={key} config={browse} />
        <SiteFooter />
      </>
    );
  }

  return (
    <BrowsePage
      title={title}
      crumb={title}
      items={results}
      subtitle={
        items.length > 0
          ? `${items.length} listings in ${title}`
          : `Showing related listings for ${title}`
      }
    />
  );
}

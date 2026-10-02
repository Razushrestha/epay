import { BrowsePage, titleForSlug } from "@/components/browse/BrowsePage";
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

  return (
    <BrowsePage
      title={title}
      crumb={title}
      items={items.length > 0 ? items : listings}
      subtitle={
        items.length > 0
          ? `${items.length} listings in ${title}`
          : `Showing related listings for ${title}`
      }
    />
  );
}

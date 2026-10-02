import { BrowsePage } from "@/components/browse/BrowsePage";
import { listings } from "@/lib/home-data";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const filtered = listings.filter((l) => {
    const matchesQuery =
      !query ||
      l.title.toLowerCase().includes(query) ||
      l.category.includes(query);
    const matchesCategory = !category || category === "all" || l.category === category;
    return matchesQuery && matchesCategory;
  });

  return (
    <BrowsePage
      title={query ? `Results for “${q}”` : "Search"}
      crumb="Search"
      items={filtered}
      subtitle={
        query
          ? `${filtered.length} results${category && category !== "all" ? ` in ${category}` : ""}`
          : "Type a keyword in the search bar"
      }
    />
  );
}

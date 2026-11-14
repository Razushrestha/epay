import { redirect } from "next/navigation";
import { categorySearchHref, fetchCategoryTree, flattenCatalog, type CatalogNode } from "@/lib/catalog";

function findBySlug(nodes: CatalogNode[], slug: string): CatalogNode | null {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const hit = findBySlug(node.children || [], slug);
    if (hit) return hit;
  }
  return null;
}

/** Old `/categories/<slug>` links: send them to the live category (managed in Admin → Catalog) or the home page. */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (slug === "deals") redirect("/deals");
  if (slug === "saved") redirect("/watchlist");
  if (slug === "sell") redirect("/sell");

  const tree = await fetchCategoryTree().catch(() => [] as CatalogNode[]);
  const match = findBySlug(tree, slug);
  if (match) redirect(categorySearchHref(match.id));

  // Tolerate a name-style slug such as "banknotes-and-coins".
  const byName = flattenCatalog(tree).find(
    (node) => node.name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") === slug,
  );
  if (byName) redirect(categorySearchHref(byName.id));

  redirect("/");
}

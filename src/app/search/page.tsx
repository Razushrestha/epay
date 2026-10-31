import { apiBase } from "@/lib/account-api";
import type { CatalogNode, CategoryDetail } from "@/lib/catalog";
import { SearchClient, type SearchListing } from "./SearchClient";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

async function loadCatalog(categoryId: string): Promise<{
  tree: CatalogNode[];
  detail: CategoryDetail | null;
}> {
  try {
    const [treeRes, detailRes] = await Promise.all([
      fetch(`${apiBase}/api/v1/catalog/categories/tree`, { cache: "no-store" }),
      categoryId
        ? fetch(`${apiBase}/api/v1/catalog/categories/${categoryId}`, { cache: "no-store" })
        : Promise.resolve(null),
    ]);
    const treeBody = treeRes.ok ? ((await treeRes.json()) as { tree?: CatalogNode[] }) : { tree: [] };
    const detail = detailRes && detailRes.ok ? ((await detailRes.json()) as CategoryDetail) : null;
    return { tree: treeBody.tree || [], detail };
  } catch {
    return { tree: [], detail: null };
  }
}

async function loadResults(q: string, categoryId: string): Promise<{
  listings: SearchListing[];
  total: number;
  facets: Record<string, { value: string; count: number }[]>;
}> {
  try {
    const params = new URLSearchParams({ limit: "24", offset: "0", sort: "best_match" });
    if (q) params.set("q", q);
    if (categoryId) params.set("category_id", categoryId);
    const path = q ? `/api/v1/listings/search?${params}` : `/api/v1/listings?${params}`;
    const res = await fetch(`${apiBase}${path}`, { cache: "no-store" });
    if (!res.ok) return { listings: [], total: 0, facets: {} };
    const data = (await res.json()) as {
      listings?: SearchListing[];
      total?: number;
      facets?: Record<string, { value: string; count: number }[]>;
    };
    const listings = data.listings || [];
    return {
      listings,
      total: Number(data.total || listings.length || 0),
      facets: data.facets || {},
    };
  } catch {
    return { listings: [], total: 0, facets: {} };
  }
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = await searchParams;
  const q = firstParam(params.q);
  const categoryId = /^\d+$/.test(firstParam(params.category_id) || firstParam(params.category))
    ? firstParam(params.category_id) || firstParam(params.category)
    : "";
  const [catalog, results] = await Promise.all([loadCatalog(categoryId), loadResults(q, categoryId)]);
  return (
    <SearchClient
      initialTree={catalog.tree}
      initialDetail={catalog.detail}
      initialListings={results.listings}
      initialTotal={results.total}
      initialFacets={results.facets}
    />
  );
}

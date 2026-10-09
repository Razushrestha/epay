import { apiBase } from "@/lib/account-api";

export type CatalogNode = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  level: number;
  children?: CatalogNode[];
};

export function categorySearchHref(id: number) {
  return `/search?category_id=${id}`;
}

export async function fetchCategoryTree(): Promise<CatalogNode[]> {
  const res = await fetch(`${apiBase}/api/v1/catalog/categories/tree`);
  if (!res.ok) return [];
  const body = (await res.json()) as { tree?: CatalogNode[] };
  return body.tree || [];
}

export async function fetchLevel1Categories(): Promise<CatalogNode[]> {
  const res = await fetch(`${apiBase}/api/v1/catalog/categories?level=1`);
  if (!res.ok) return [];
  const body = (await res.json()) as { categories?: CatalogNode[] };
  return body.categories || [];
}

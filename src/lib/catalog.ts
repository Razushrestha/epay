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

let cachedTree: CatalogNode[] = [];

export function peekCategoryTree() {
  return cachedTree;
}

export function seedCategoryTree(tree: CatalogNode[]) {
  if (tree.length) cachedTree = tree;
}

export async function fetchCategoryTree(): Promise<CatalogNode[]> {
  const root = typeof window === "undefined" ? apiBase : "";
  if (typeof window === "undefined" && cachedTree.length) return cachedTree;
  const res = await fetch(`${root}/api/v1/catalog/categories/tree`, { cache: "no-store" });
  if (!res.ok) return cachedTree;
  const body = (await res.json()) as { tree?: CatalogNode[] };
  cachedTree = body.tree || [];
  return cachedTree;
}

export async function fetchLevel1Categories(): Promise<CatalogNode[]> {
  const root = typeof window === "undefined" ? apiBase : "";
  const res = await fetch(`${root}/api/v1/catalog/categories?level=1`);
  if (!res.ok) return [];
  const body = (await res.json()) as { categories?: CatalogNode[] };
  return body.categories || [];
}

export type CategorySpecific = {
  id: number;
  name: string;
  slug: string;
  input_type: string;
  is_required?: boolean;
  unit?: string | null;
  min_value?: number | string | null;
  max_value?: number | string | null;
  options?: { id: number; value: string }[] | null;
};

export type CategoryDetail = {
  category: CatalogNode;
  breadcrumb: { id: number; name: string; slug: string; level: number }[];
  subcategories: CatalogNode[];
  specifics: CategorySpecific[];
};

export async function fetchCategoryDetail(idOrSlug: string | number): Promise<CategoryDetail | null> {
  const res = await fetch(`${apiBase}/api/v1/catalog/categories/${idOrSlug}`);
  if (!res.ok) return null;
  return (await res.json()) as CategoryDetail;
}

export function flattenCatalog(nodes: CatalogNode[], trail: string[] = []): { id: number; name: string; label: string; level: number }[] {
  return nodes.flatMap((node) => {
    const path = [...trail, node.name];
    return [
      { id: node.id, name: node.name, label: path.join(" › "), level: node.level },
      ...flattenCatalog(node.children || [], path),
    ];
  });
}

"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { fetchCategoryTree, peekCategoryTree, seedCategoryTree, type CatalogNode, type CategoryDetail } from "@/lib/catalog";

function findTrail(nodes: CatalogNode[], id: string, path: CatalogNode[] = []): CatalogNode[] | null {
  for (const node of nodes) {
    const next = [...path, node];
    if (String(node.id) === String(id)) return next;
    const hit = findTrail(node.children || [], id, next);
    if (hit) return hit;
  }
  return null;
}

export function CategoryTreePanel({
  categoryId,
  query,
  onCategoryName,
  initialTree,
  initialDetail,
  children,
}: {
  categoryId: string;
  query: string;
  onCategoryName?: (name: string) => void;
  initialTree?: CatalogNode[];
  initialDetail?: CategoryDetail | null;
  children?: ReactNode;
}) {
  const [tree, setTree] = useState<CatalogNode[]>(() => {
    if (initialTree?.length) seedCategoryTree(initialTree);
    return initialTree?.length ? initialTree : peekCategoryTree();
  });
  const [detail, setDetail] = useState<CategoryDetail | null>(initialDetail ?? null);

  useEffect(() => {
    if (initialTree?.length) {
      seedCategoryTree(initialTree);
      setTree(initialTree);
      return;
    }
    fetchCategoryTree()
      .then(setTree)
      .catch(() => setTree(peekCategoryTree()));
  }, [initialTree]);

  useEffect(() => {
    if (initialDetail && String(initialDetail.category?.id) === String(categoryId)) {
      setDetail(initialDetail);
      return;
    }
    if (!categoryId) {
      setDetail(null);
      return;
    }
    fetch(`/api/v1/catalog/categories/${categoryId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setDetail(body))
      .catch(() => setDetail(null));
  }, [categoryId, initialDetail]);

  const trail = categoryId ? findTrail(tree, categoryId) : [];
  const crumbs = detail?.breadcrumb?.length
    ? detail.breadcrumb
    : (trail || []).map((node) => ({ id: node.id, name: node.name, slug: node.slug, level: node.level }));
  const categoryName = crumbs.at(-1)?.name || "";

  useEffect(() => {
    onCategoryName?.(categoryName);
  }, [categoryName, onCategoryName]);

  function hrefFor(id?: number | string | null) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (id) params.set("category_id", String(id));
    const qs = params.toString();
    return qs ? `/search?${qs}` : "/search";
  }

  return (
    <>
      <p className="text-[12.5px] text-[#98a2b3]" aria-label="Category path">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        {crumbs.length ? (
          crumbs.map((crumb, index) => (
            <span key={crumb.id}>
              <span className="mx-1.5">›</span>
              {index === crumbs.length - 1 ? (
                <span className="text-[#667085]">{crumb.name}</span>
              ) : (
                <Link href={hrefFor(crumb.id)} className="hover:underline">
                  {crumb.name}
                </Link>
              )}
            </span>
          ))
        ) : (
          <>
            <span className="mx-1.5">›</span>
            <span className="text-[#667085]">{query ? "Search" : "All listings"}</span>
          </>
        )}
      </p>
      {children}
    </>
  );
}

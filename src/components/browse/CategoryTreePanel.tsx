"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { fetchCategoryTree, peekCategoryTree, seedCategoryTree, type CatalogNode, type CategoryDetail, type CategorySpecific } from "@/lib/catalog";

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
  specFilters,
  onSpec,
  onCategoryName,
  initialTree,
  initialDetail,
  children,
}: {
  categoryId: string;
  query: string;
  specFilters: Record<string, string>;
  onSpec: (slug: string, value: string) => void;
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
  const current = trail?.at(-1) || detail?.category || null;
  const childNodes = current?.children?.length ? current.children : detail?.subcategories || [];
  const browseNodes = categoryId ? childNodes : tree;
  const isLeaf = Boolean(categoryId && current && !childNodes.length);
  const specifics: CategorySpecific[] = detail?.specifics || [];
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

      <section className="mt-4 rounded-2xl border border-[#e7eef6] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-[#0f1c3f]">Category browser</h2>
          {categoryId ? (
            <Link
              href={hrefFor(current?.parent_id || crumbs[crumbs.length - 2]?.id || "")}
              className="text-[13px] font-semibold text-[#3665f3] hover:underline"
            >
              {crumbs.length > 1 ? `‹ ${crumbs[crumbs.length - 2].name}` : "All categories"}
            </Link>
          ) : null}
        </div>
        {browseNodes.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {browseNodes.map((node) => (
              <li key={node.id}>
                <Link
                  href={hrefFor(node.id)}
                  className="inline-flex h-9 items-center rounded-full border border-[#e7eef6] bg-[#f7fafd] px-4 text-[13px] font-medium text-[#0f1c3f] hover:border-[#3665f3] hover:text-[#3665f3]"
                >
                  {node.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : isLeaf ? (
          <p className="mt-2 text-[13px] text-[#6b7587]">Leaf category. Item specifics for this path are below.</p>
        ) : null}

        {isLeaf && specifics.length ? (
          <div className="mt-4 border-t border-[#eef2f7] pt-4">
            <h3 className="text-[14px] font-bold text-[#0f1c3f]">Item specifics</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {specifics.map((spec) => (
                <div key={spec.slug}>
                  <p className="text-[12px] font-semibold text-[#0f1c3f]">
                    {spec.name}
                    {spec.is_required ? <span className="text-[#e11d48]"> *</span> : null}
                  </p>
                  {spec.options?.length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {spec.options.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onSpec(spec.slug, opt.value)}
                          className={`rounded-full px-3 py-1.5 text-[12px] ${specFilters[spec.slug] === opt.value ? "bg-[#3665f3] text-white" : "bg-[#f4f8fd] text-[#0f1c3f]"}`}
                        >
                          {opt.value}
                        </button>
                      ))}
                    </div>
                  ) : spec.input_type === "number" ? (
                    <p className="mt-1 text-[12px] text-[#6b7587]">
                      Number{spec.unit ? ` (${spec.unit})` : ""}
                      {spec.min_value != null || spec.max_value != null
                        ? ` · ${spec.min_value ?? "0"}–${spec.max_value ?? "∞"}`
                        : ""}
                    </p>
                  ) : (
                    <p className="mt-1 text-[12px] text-[#6b7587]">Free text on the listing form.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}

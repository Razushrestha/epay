"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { categorySearchHref, fetchCategoryTree, type CatalogNode } from "@/lib/catalog";

function chunk<T>(items: T[], size: number) {
  const columns: T[][] = Array.from({ length: size }, () => []);
  items.forEach((item, index) => {
    columns[index % size].push(item);
  });
  return columns.filter((col) => col.length);
}

export function CategoryMenu() {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<CatalogNode[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    fetchCategoryTree()
      .then(setTree)
      .catch(() => setTree([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const columns = chunk(tree, 3);

  return (
    <div ref={rootRef} className="relative z-50 hidden shrink-0 xl:block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 text-[12px] leading-tight text-[#555] hover:text-black"
      >
        <span className="text-left">
          Shop by
          <br />
          category
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          className={`transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute left-0 top-[calc(100%+14px)] z-50 w-[760px] overflow-hidden rounded-lg border border-[#ececec] bg-white shadow-[0_12px_40px_-16px_rgba(0,0,0,0.28)]"
        >
          <div className="grid max-h-[min(70vh,520px)] grid-cols-3 gap-x-8 overflow-y-auto px-6 py-5">
            {columns.length ? (
              columns.map((column, index) => (
                <div key={index} className="space-y-6">
                  {column.map((group) => (
                    <div key={group.id}>
                      <Link
                        href={categorySearchHref(group.id)}
                        onClick={() => setOpen(false)}
                        className="text-[14px] font-bold text-[#191919] hover:underline"
                      >
                        {group.name}
                      </Link>
                      {(group.children || []).length ? (
                        <ul className="mt-2.5 space-y-2">
                          {(group.children || []).slice(0, 8).map((item) => (
                            <li key={item.id}>
                              <Link
                                href={categorySearchHref(item.id)}
                                onClick={() => setOpen(false)}
                                className="text-[13.5px] text-[#555] hover:text-[#3665f3] hover:underline"
                              >
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-[12.5px] text-[#8a94a6]">See all listings</p>
                      )}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <p className="col-span-3 text-[13px] text-[#707070]">Loading categories…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

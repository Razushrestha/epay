"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fetchLevel1Categories, type CatalogNode } from "@/lib/catalog";

export function SearchCategoryMenu({
  name = "category_id",
  defaultValue = "",
}: {
  name?: string;
  defaultValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [categories, setCategories] = useState<CatalogNode[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = categories.find((item) => String(item.id) === value);

  useEffect(() => {
    fetchLevel1Categories()
      .then(setCategories)
      .catch(() => setCategories([]));
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

  return (
    <div ref={rootRef} className="relative z-50 hidden shrink-0 md:block">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((next) => !next)}
        className="flex max-w-[168px] items-center gap-1.5 bg-transparent pr-1 text-[14px] text-[#191919]"
      >
        <span className="truncate">{current?.name || "All Categories"}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="shrink-0" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="All Categories"
          className="absolute right-0 top-[calc(100%+16px)] max-h-[360px] w-[250px] overflow-y-auto rounded-md border border-[#e6e6e6] bg-white py-1 shadow-[0_10px_28px_-12px_rgba(0,0,0,0.35)]"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => {
                setValue("");
                setOpen(false);
              }}
              className={`block w-full px-3 py-[7px] text-left text-[14px] ${
                !value ? "bg-[#3665f3] text-white" : "text-[#191919] hover:bg-[#3665f3] hover:text-white"
              }`}
            >
              All Categories
            </button>
          </li>
          {categories.map((item) => {
            const selected = String(item.id) === value;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setValue(String(item.id));
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-[7px] text-left text-[14px] ${
                    selected ? "bg-[#3665f3] text-white" : "text-[#191919] hover:bg-[#3665f3] hover:text-white"
                  }`}
                >
                  {item.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

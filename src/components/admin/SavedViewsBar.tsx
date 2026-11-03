"use client";

import { useEffect, useState } from "react";
import { addSavedView, loadSavedViews, removeSavedView, type SavedView } from "@/lib/admin-saved-views";

export function SavedViewsBar({
  desk,
  role,
  current,
  onApply,
}: {
  desk: string;
  role: string;
  current: { query?: string; status?: string };
  onApply: (view: SavedView) => void;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    setViews(loadSavedViews(desk, role));
  }, [desk, role]);

  function save() {
    const label = name.trim() || [current.status, current.query].filter(Boolean).join(" · ") || "Saved view";
    const next = addSavedView(desk, role, {
      name: label.slice(0, 40),
      query: current.query || "",
      status: current.status || "",
    });
    setViews(next);
    setName("");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {views.map((view) => (
        <span key={view.id} className="inline-flex items-center gap-1 rounded-full bg-[#eef4ff] px-2.5 py-1 text-[12px] font-semibold text-[#3665f3]">
          <button type="button" onClick={() => onApply(view)} className="hover:underline">
            {view.name}
          </button>
          <button
            type="button"
            aria-label={`Remove ${view.name}`}
            className="text-[#8a94a6] hover:text-[#e5484d]"
            onClick={() => setViews(removeSavedView(desk, role, view.id))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Save view as…"
        className="h-8 min-w-[140px] rounded-full border border-[#e7eef6] px-3 text-[12px]"
      />
      <button type="button" onClick={save} className="h-8 rounded-full border border-[#e7eef6] px-3 text-[12px] font-semibold text-[#3a4a66]">
        Save view
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { WATCH_EVENT, loadWatchIds, toggleWatch } from "@/lib/commerce";

export function SaveButton({
  listingId,
  title,
  photo,
  price,
  className = "",
}: {
  listingId: number;
  title: string;
  photo?: string | null;
  price?: string | number;
  className?: string;
}) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    async function refresh() {
      const ids = await loadWatchIds();
      if (alive) setSaved(ids.has(listingId));
    }
    refresh();
    window.addEventListener(WATCH_EVENT, refresh);
    return () => {
      alive = false;
      window.removeEventListener(WATCH_EVENT, refresh);
    };
  }, [listingId]);

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from watchlist" : "Add to watchlist"}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const next = !saved;
        setSaved(next);
        try {
          await toggleWatch({ listingId, saved: !next, title, photo, price, localOnly: true });
        } catch {
          setSaved(!next);
        }
      }}
      className={`flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[16px] shadow-sm ${saved ? "text-[#e53238]" : "text-[#333]"} ${className}`}
    >
      {saved ? "♥" : "♡"}
    </button>
  );
}

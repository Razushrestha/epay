"use client";

import dynamic from "next/dynamic";

export const HeaderSearch = dynamic(() => import("@/components/SearchBar").then((mod) => mod.SearchBar), {
  ssr: false,
  loading: () => <div className="h-11 min-w-0 flex-1 rounded-full border border-[#e2e8f0] bg-white" />,
});

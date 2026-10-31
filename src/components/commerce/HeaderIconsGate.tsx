"use client";

import dynamic from "next/dynamic";

export const HeaderIcons = dynamic(
  () => import("@/components/commerce/HeaderIcons").then((mod) => mod.HeaderIcons),
  {
    ssr: false,
    loading: () => <div className="flex h-[22px] w-[70px] shrink-0" aria-hidden />,
  },
);

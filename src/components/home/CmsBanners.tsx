"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";

type Banner = { title: string; image_url: string | null; link: string | null; position: string };

export function CmsBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    accountApi<{ data: Banner[] }>("/api/v1/site/banners")
      .then((b) => setBanners((b.data || []).filter((row) => row.position === "home_hero" || row.position === "home")))
      .catch(() => undefined);
  }, []);

  if (!banners.length) return null;

  return (
    <div className="page-shell mt-3 grid gap-3 sm:grid-cols-2">
      {banners.map((banner) => (
        <Link key={banner.title} href={banner.link || "/shop"} className="overflow-hidden rounded-2xl bg-[#eaf1ff] p-5">
          <p className="text-[18px] font-extrabold text-[#0f1c3f]">{banner.title}</p>
          {banner.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner.image_url} alt="" className="mt-3 h-28 w-full rounded-xl object-cover" />
          ) : null}
        </Link>
      ))}
    </div>
  );
}

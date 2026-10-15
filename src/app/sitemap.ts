import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://epay-zeta.vercel.app";
  const paths = ["", "/shop", "/deals", "/sell", "/help", "/help/faq", "/buyer-protection", "/help/selling-guide", "/help/returns", "/resolution"];
  return paths.map((path) => ({
    url: `${base}${path || "/"}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.6,
  }));
}

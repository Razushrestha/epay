import type { NextConfig } from "next";

const apiOrigin = (process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(
  /\/$/,
  "",
);

function hostPattern(raw?: string) {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return {
      protocol: (parsed.protocol.replace(":", "") === "http" ? "http" : "https") as "http" | "https",
      hostname: parsed.hostname,
      pathname: "/**" as const,
    };
  } catch {
    return null;
  }
}

const cdnPrefix = (process.env.NEXT_PUBLIC_CDN_URL || "").replace(/\/$/, "");
const remotePatterns = [
  { protocol: "https" as const, hostname: "images.unsplash.com" },
  hostPattern(process.env.NEXT_PUBLIC_CDN_URL),
  hostPattern(process.env.CDN_PUBLIC_URL),
  hostPattern(process.env.AWS_ENDPOINT_URL_S3),
].filter(Boolean) as { protocol: "http" | "https"; hostname: string; pathname?: `/${string}` }[];

const nextConfig: NextConfig = {
  assetPrefix: cdnPrefix || undefined,
  images: {
    remotePatterns,
  },
  async redirects() {
    return [{ source: "/help/buyer-protection", destination: "/buyer-protection", permanent: false }];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

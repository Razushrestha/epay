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

/**
 * Content-Security-Policy for the website (production only: dev hot reload needs eval/websockets).
 * Next.js emits inline bootstrap scripts, so script-src keeps 'unsafe-inline'. This policy still blocks
 * plugins, <base> hijacking, framing by other sites, and data leaving to unlisted hosts via fetch/XHR.
 * Hosts below are the social sign-in providers used by SocialSignIn.tsx.
 */
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://appleid.cdn-apple.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://graph.facebook.com https://www.facebook.com https://appleid.apple.com",
  "frame-src 'self' https://accounts.google.com https://appleid.apple.com https://www.facebook.com https://staticxx.facebook.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: cspDirectives }]
    : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  assetPrefix: cdnPrefix || undefined,
  images: {
    remotePatterns,
  },
  async redirects() {
    return [
      { source: "/help/buyer-protection", destination: "/buyer-protection", permanent: false },
      { source: "/forgot", destination: "/forgot-password", permanent: false },
      { source: "/auth/forgot", destination: "/forgot-password", permanent: false },
      { source: "/auth/reset", destination: "/reset", permanent: false },
    ];
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

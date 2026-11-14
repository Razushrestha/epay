/** Shared CORS allowlist + baseline security headers for the API. */

function isLocalDevOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (/^10(?:\.\d{1,3}){3}$/.test(hostname)) return true;
    if (/^192\.168(?:\.\d{1,3}){2}$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

export function corsAllowed(origin) {
  if (!origin) return false;
  const configured = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (configured.includes("*") || configured.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production" && isLocalDevOrigin(origin)) return true;
  if (!configured.length && isLocalDevOrigin(origin)) return true;
  return false;
}

/** Headers for long-lived streaming responses (SSE): allowlisted origin only, never "*". */
export function corsStreamHeaders(req) {
  const origin = req.headers.origin;
  return corsAllowed(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
}

/** Baseline hardening headers for API responses. */
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/** Strict CSP is applied to JSON responses only (payment callbacks return HTML pages). */
export const API_JSON_CSP = "default-src 'none'; frame-ancestors 'none'";

export function setSecurityHeaders(res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

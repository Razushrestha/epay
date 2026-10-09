function stripSlash(value) {
  return String(value || "").replace(/\/$/, "");
}

function isPlaceholder(url) {
  return !url || /your-frontend|example\.com/i.test(url);
}

export function originFromHeaders(headers = {}) {
  const host = headers.host || headers.Host;
  if (!host) return "";
  const proto = headers["x-forwarded-proto"] || (String(host).includes("localhost") || String(host).startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export function publicFrontend(headers = {}) {
  const env = stripSlash(process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "");
  if (!isPlaceholder(env)) return env;
  if (process.env.NODE_ENV === "production" && env) {
    console.warn("[payments] FRONTEND_URL/CORS_ORIGIN looks like a placeholder; set FRONTEND_URL to the live Next.js origin");
  }
  return env || "http://localhost:3000";
}

export function publicApi(headers = {}) {
  const env = stripSlash(process.env.API_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "");
  if (env) return env;
  return originFromHeaders(headers) || "http://localhost:4000";
}

export function parseGatewayPid(pid) {
  const raw = String(pid || "");
  const lastDash = raw.lastIndexOf("-");
  if (lastDash < 0) return { orderNumber: raw, paymentId: null };
  return {
    orderNumber: raw.slice(0, lastDash),
    paymentId: raw.slice(lastDash + 1),
  };
}

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = "server";
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.mjs$/.test(name) && !name.includes(".test.")) out.push(p);
  }
  return out;
}

const files = walk(root);
const routes = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  // pathname === `${API}/...` && method === "X"
  const exact = /pathname\s*===\s*`\$\{API(?:_PREFIX)?\}([^`]+)`\s*&&\s*method\s*===\s*"([A-Z]+)"/g;
  let m;
  while ((m = exact.exec(text))) {
    routes.push({ method: m[2], path: `/api/v1${m[1]}`, file, kind: "exact" });
  }
  const exactRev = /method\s*===\s*"([A-Z]+)"\s*&&\s*\(?pathname\s*===\s*`\$\{API(?:_PREFIX)?\}([^`]+)`/g;
  while ((m = exactRev.exec(text))) {
    routes.push({ method: m[1], path: `/api/v1${m[2]}`, file, kind: "exact" });
  }
  // pathname.startsWith address routes with :id
  if (/pathname\.startsWith\(`\$\{API\}\/account\/addresses\//.test(text)) {
    routes.push({ method: "PATCH", path: "/api/v1/account/addresses/:id", file, kind: "param" });
    routes.push({ method: "DELETE", path: "/api/v1/account/addresses/:id", file, kind: "param" });
  }
  if (/pathname\.startsWith\(`\$\{API\}\/account\/passkeys\//.test(text)) {
    routes.push({ method: "DELETE", path: "/api/v1/account/passkeys/:id", file, kind: "param" });
  }
  if (/pathname\.startsWith\(`\$\{API\}\/account\/collections\//.test(text)) {
    routes.push({ method: "GET", path: "/api/v1/account/collections/:id", file, kind: "param" });
    routes.push({ method: "PATCH", path: "/api/v1/account/collections/:id", file, kind: "param" });
    routes.push({ method: "DELETE", path: "/api/v1/account/collections/:id", file, kind: "param" });
    routes.push({ method: "POST", path: "/api/v1/account/collections/:id/items", file, kind: "param" });
    routes.push({ method: "DELETE", path: "/api/v1/account/collections/:id/items/:itemId", file, kind: "param" });
  }
  if (/pathname\.startsWith\(`\$\{API\}\/admin\/appeals\//.test(text)) {
    routes.push({ method: "POST", path: "/api/v1/admin/appeals/:id", file, kind: "param" });
  }
  if (/pathname\.startsWith\(`\$\{API\}\/admin\/kyc\//.test(text)) {
    routes.push({ method: "POST", path: "/api/v1/admin/kyc/:id", file, kind: "param" });
  }
  if (/pathname\.startsWith\(`\$\{API\}\/account\/sessions\//.test(text)) {
    routes.push({ method: "DELETE", path: "/api/v1/account/sessions/:id", file, kind: "param" });
  }
}

// Router specials
routes.push({ method: "GET", path: "/health", file: "server/router.mjs", kind: "exact" });
routes.push({ method: "GET", path: "/api/v1/categories", file: "server/router.mjs", kind: "exact" });
routes.push({ method: "GET", path: "/api/v1/categories/:slug", file: "server/router.mjs", kind: "param" });
routes.push({ method: "GET", path: "/api/v1/categories/tree", file: "server/router.mjs", kind: "exact" });
routes.push({ method: "GET", path: "/api/v1/auctions/:id/stream", file: "server/router.mjs", kind: "param" });

// Mounted module routes (reviewed from source)
const mounted = [
  // catalog
  ["GET", "/api/v1/catalog/categories"],
  ["GET", "/api/v1/catalog/categories/tree"],
  ["GET", "/api/v1/catalog/categories/:slug"],
  ["GET", "/api/v1/catalog/categories/:id/specifics"],
  ["GET", "/api/v1/catalog/conditions"],
  ["GET", "/api/v1/catalog/brands"],
  ["GET", "/api/v1/catalog/admin/fees"],
  ["PUT", "/api/v1/catalog/admin/fees/:id"],
  ["POST", "/api/v1/catalog/admin/categories"],
  ["PATCH", "/api/v1/catalog/admin/categories/:id"],
  ["DELETE", "/api/v1/catalog/admin/categories/:id"],
  ["POST", "/api/v1/catalog/admin/categories/reorder"],
  ["PUT", "/api/v1/catalog/admin/categories/:id/fees"],
  ["POST", "/api/v1/catalog/admin/specifics"],
  ["PATCH", "/api/v1/catalog/admin/specifics/:id"],
  ["DELETE", "/api/v1/catalog/admin/specifics/:id"],
  ["POST", "/api/v1/catalog/admin/brands"],
  ["PATCH", "/api/v1/catalog/admin/brands/:id"],
  ["DELETE", "/api/v1/catalog/admin/brands/:id"],
  ["POST", "/api/v1/catalog/admin/restrictions"],
  ["DELETE", "/api/v1/catalog/admin/restrictions/:id"],
  // listings
  ["GET", "/api/v1/listings"],
  ["GET", "/api/v1/listings/deals"],
  ["GET", "/api/v1/listings/search"],
  ["GET", "/api/v1/listings/suggest"],
  ["GET", "/api/v1/listings/featured"],
  ["GET", "/api/v1/listings/recent"],
  ["GET", "/api/v1/listings/watchlist"],
  ["GET", "/api/v1/listings/saved-searches"],
  ["POST", "/api/v1/listings/saved-searches"],
  ["DELETE", "/api/v1/listings/saved-searches/:id"],
  ["GET", "/api/v1/listings/seller/listings"],
  ["GET", "/api/v1/listings/seller/analytics"],
  ["GET", "/api/v1/listings/:id"],
  ["GET", "/api/v1/listings/:id/similar"],
  ["GET", "/api/v1/listings/:id/shipping"],
  ["POST", "/api/v1/listings"],
  ["PATCH", "/api/v1/listings/:id"],
  ["DELETE", "/api/v1/listings/:id"],
  ["POST", "/api/v1/listings/:id/publish"],
  ["POST", "/api/v1/listings/:id/end"],
  ["POST", "/api/v1/listings/:id/relist"],
  ["POST", "/api/v1/listings/:id/photos"],
  ["POST", "/api/v1/listings/:id/photos/upload"],
  ["PATCH", "/api/v1/listings/:id/photos/reorder"],
  ["DELETE", "/api/v1/listings/photos/:id"],
  ["PATCH", "/api/v1/listings/photos/:id/primary"],
  ["POST", "/api/v1/listings/:id/watch"],
  ["DELETE", "/api/v1/listings/:id/watch"],
  ["POST", "/api/v1/listings/:id/question"],
  ["PATCH", "/api/v1/listings/questions/:id"],
  ["POST", "/api/v1/listings/bulk"],
  // cart
  ["GET", "/api/v1/cart"],
  ["POST", "/api/v1/cart"],
  ["PATCH", "/api/v1/cart/:id"],
  ["DELETE", "/api/v1/cart/:id"],
  ["DELETE", "/api/v1/cart/clear"],
  ["POST", "/api/v1/cart/validate"],
  ["POST", "/api/v1/cart/checkout/reserve"],
  ["POST", "/api/v1/cart/checkout/calculate"],
  ["POST", "/api/v1/cart/checkout/apply-coupon"],
  ["POST", "/api/v1/cart/checkout/create-order"],
  // payments
  ["POST", "/api/v1/payments/initiate"],
  ["GET", "/api/v1/payments/callback/:gateway"],
  ["POST", "/api/v1/payments/webhook/:gateway"],
  ["GET", "/api/v1/payments/esewa/redirect/:id"],
  ["GET", "/api/v1/payments/status/:id"],
  ["POST", "/api/v1/payments/khalti/lookup"],
  // orders (fulfillment)
  ["GET", "/api/v1/orders"],
  ["GET", "/api/v1/orders/selling"],
  ["GET", "/api/v1/orders/policy"],
  ["PUT", "/api/v1/orders/policy"],
  ["GET", "/api/v1/orders/:id"],
  ["GET", "/api/v1/orders/:id/invoice"],
  ["POST", "/api/v1/orders/:id/ship"],
  ["POST", "/api/v1/orders/:id/deliver"],
  ["POST", "/api/v1/orders/:id/complete"],
  ["POST", "/api/v1/orders/:id/cancel"],
  // auctions
  ["GET", "/api/v1/auctions"],
  ["GET", "/api/v1/auctions/second-chance"],
  ["GET", "/api/v1/auctions/:id"],
  ["POST", "/api/v1/auctions/:id/bid"],
  ["POST", "/api/v1/auctions/:id/retract"],
  ["GET", "/api/v1/auctions/blocked"],
  ["POST", "/api/v1/auctions/blocked"],
  ["DELETE", "/api/v1/auctions/blocked/:id"],
  ["POST", "/api/v1/auctions/second-chance"],
  // offers
  ["GET", "/api/v1/offers"],
  ["POST", "/api/v1/offers"],
  ["POST", "/api/v1/offers/:id/decide"],
  // returns / cases
  ["GET", "/api/v1/returns"],
  ["POST", "/api/v1/returns"],
  ["GET", "/api/v1/returns/:id"],
  ["POST", "/api/v1/returns/:id/decide"],
  ["POST", "/api/v1/returns/:id/ship"],
  ["POST", "/api/v1/returns/:id/receive"],
  ["GET", "/api/v1/cases"],
  ["POST", "/api/v1/cases"],
  ["GET", "/api/v1/cases/:id"],
  ["POST", "/api/v1/cases/:id/messages"],
  ["POST", "/api/v1/cases/:id/evidence"],
  ["POST", "/api/v1/cases/:id/decide"],
  ["POST", "/api/v1/cases/:id/appeal"],
  // inbox
  ["GET", "/api/v1/conversations"],
  ["POST", "/api/v1/conversations"],
  ["GET", "/api/v1/conversations/:id/messages"],
  ["POST", "/api/v1/conversations/:id/messages"],
  ["POST", "/api/v1/conversations/:id/report"],
  ["GET", "/api/v1/messages"],
  // feedback / notify
  ["POST", "/api/v1/feedback"],
  ["POST", "/api/v1/feedback/:id/reply"],
  ["GET", "/api/v1/notifications"],
  ["POST", "/api/v1/notifications/read"],
  ["GET", "/api/v1/notifications/preferences"],
  ["PATCH", "/api/v1/notifications/preferences"],
  // wallet / ledger
  ["GET", "/api/v1/wallet"],
  ["POST", "/api/v1/wallet/accounts"],
  ["POST", "/api/v1/wallet/payouts"],
  ["GET", "/api/v1/admin/payouts"],
  ["PATCH", "/api/v1/admin/payouts/:id"],
  ["POST", "/api/v1/admin/refunds"],
  ["GET", "/api/v1/admin/ledger"],
  // seller tools
  ["GET", "/api/v1/seller/dashboard"],
  ["GET", "/api/v1/seller/inventory"],
  ["POST", "/api/v1/seller/inventory/bulk"],
  ["GET", "/api/v1/seller/vacation"],
  ["PUT", "/api/v1/seller/vacation"],
  ["GET", "/api/v1/seller/replies"],
  ["POST", "/api/v1/seller/replies"],
  ["DELETE", "/api/v1/seller/replies/:id"],
  ["GET", "/api/v1/seller/reports"],
  ["GET", "/api/v1/seller/label"],
  ["POST", "/api/v1/reports"],
  // site / help / tickets
  ["GET", "/api/v1/site/banners"],
  ["GET", "/api/v1/help"],
  ["GET", "/api/v1/help/:slug"],
  ["GET", "/api/v1/tickets"],
  ["POST", "/api/v1/tickets"],
  // admin ops / trust
  ["GET", "/api/v1/admin/disputes"],
  ["GET", "/api/v1/admin/moderation"],
  ["POST", "/api/v1/admin/moderation/:id"],
  ["GET", "/api/v1/admin/cms"],
  ["POST", "/api/v1/admin/cms/pages"],
  ["POST", "/api/v1/admin/cms/banners"],
  ["PATCH", "/api/v1/admin/cms/settings"],
  ["GET", "/api/v1/admin/tickets"],
  ["POST", "/api/v1/admin/tickets"],
  ["GET", "/api/v1/admin/tickets/:id"],
  ["PATCH", "/api/v1/admin/tickets/:id"],
  ["GET", "/api/v1/admin/audit"],
  ["GET", "/api/v1/admin/finance"],
  ["GET", "/api/v1/admin/roles"],
  ["PATCH", "/api/v1/admin/roles"],
  ["GET", "/api/v1/admin/trust"],
  ["POST", "/api/v1/admin/trust/blacklist"],
  ["POST", "/api/v1/admin/strikes"],
];

for (const [method, path] of mounted) {
  routes.push({ method, path, file: "server/* (mounted)", kind: path.includes(":") ? "param" : "exact" });
}

const seen = new Set();
const uniq = [];
for (const r of routes) {
  const key = `${r.method} ${r.path}`;
  if (seen.has(key)) continue;
  seen.add(key);
  uniq.push(r);
}
uniq.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

const base = process.env.API_BASE || "http://localhost:4000";

async function probe(route) {
  if (route.path.includes(":")) {
    return { ...route, status: "skipped", note: "path param — not probed live" };
  }

  const safeGet = route.method === "GET";
  const safePostSmoke = new Set([
    "/api/v1/auth/login",
    "/api/v1/auth/passkeys/options",
    "/api/v1/auth/register",
    "/api/v1/cart/validate",
    "/api/v1/cart/checkout/calculate",
  ]);

  if (!safeGet && !safePostSmoke.has(route.path)) {
    return { ...route, status: "unprobed", note: "mutating/auth-gated — not auto-called" };
  }

  const url = `${base}${route.path}`;
  const init = {
    method: route.method,
    headers: { "Content-Type": "application/json", "User-Agent": "api-inventory" },
  };
  if (route.path === "/api/v1/auth/login") {
    init.body = JSON.stringify({ identifier: "nobody@example.com", password: "WrongPass1!" });
  } else if (route.path === "/api/v1/auth/passkeys/options") {
    init.body = JSON.stringify({ identifier: "nobody@example.com" });
  } else if (route.path === "/api/v1/auth/register") {
    init.body = JSON.stringify({ email: "bad", password: "x" });
  } else if (route.method === "POST") {
    init.body = "{}";
  }

  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let body = text.slice(0, 200);
    try {
      body = JSON.stringify(JSON.parse(text)).slice(0, 200);
    } catch {}
    let verdict = "ok";
    if (res.status >= 500) verdict = "broken";
    else if (res.status === 404) verdict = "missing";
    else if (res.status === 401 || res.status === 403) verdict = "auth";
    else if (res.status === 400 || res.status === 409 || res.status === 429) verdict = "ok";
    else if (res.status >= 200 && res.status < 300) verdict = "ok";
    else if (res.status >= 300 && res.status < 400) verdict = "ok";
    else verdict = `http_${res.status}`;
    return { ...route, http: res.status, status: verdict, body };
  } catch (err) {
    return { ...route, status: "down", note: err.message };
  }
}

const results = [];
for (const route of uniq) {
  results.push(await probe(route));
}

const summary = {
  total: results.length,
  probedOk: results.filter((r) => r.status === "ok").length,
  authProtected: results.filter((r) => r.status === "auth").length,
  broken: results.filter((r) => r.status === "broken" || r.status === "missing" || r.status === "down").length,
  unprobed: results.filter((r) => r.status === "unprobed" || r.status === "skipped").length,
  byPrefix: {},
  brokenList: results
    .filter((r) => r.status === "broken" || r.status === "missing" || r.status === "down")
    .map((r) => `${r.method} ${r.path} → ${r.status}${r.http ? ` (${r.http})` : ""}`),
  sampleOk: results.filter((r) => r.status === "ok").slice(0, 15).map((r) => `${r.method} ${r.path} (${r.http})`),
};
for (const r of results) {
  const prefix = r.path.replace(/^\/api\/v1\/?/, "/").split("/").filter(Boolean)[0] || "root";
  summary.byPrefix[prefix] = (summary.byPrefix[prefix] || 0) + 1;
}

const out = { summary, results };
writeFileSync("scripts/api-inventory-result.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`Wrote scripts/api-inventory-result.json (${results.length} routes)`);

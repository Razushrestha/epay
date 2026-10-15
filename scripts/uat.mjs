/**
 * Production / staging UAT smoke for go-live.
 * Usage: npm run test:uat
 * Env: API_URL, FRONTEND_URL, UAT_LISTING_ID
 */
const api = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
const web = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

async function check(name, url, ok = (res) => res.ok) {
  const started = Date.now();
  try {
    const res = await fetch(url, { redirect: "manual" });
    const pass = ok(res);
    return { name, url, status: res.status, ms: Date.now() - started, pass };
  } catch (err) {
    return { name, url, status: 0, ms: Date.now() - started, pass: false, error: err instanceof Error ? err.message : "failed" };
  }
}

const listingId = process.env.UAT_LISTING_ID || "6";
const checks = [
  check("API health", `${api}/health`),
  check("Catalog L1", `${api}/api/v1/catalog/categories?level=1`),
  check("Browse listings", `${api}/api/v1/listings?limit=8`),
  check("Search", `${api}/api/v1/listings/search?q=a&limit=8`),
  check("Deals", `${api}/api/v1/listings/deals?limit=6`),
  check("Listing PDP API", `${api}/api/v1/listings/${listingId}`),
  check("Auction snapshot", `${api}/api/v1/auctions/${listingId}`),
  check("Home", `${web}/`, (res) => res.status === 200),
  check("Buyer Protection", `${web}/buyer-protection`, (res) => res.status === 200),
  check("Buyer Protection redirect", `${web}/help/buyer-protection`, (res) => [301, 302, 307, 308].includes(res.status)),
  check("Help", `${web}/help`, (res) => res.status === 200),
  check("Search page", `${web}/search`, (res) => res.status === 200),
  check("Deals page", `${web}/deals`, (res) => res.status === 200),
  check("Resolution Center", `${web}/resolution`, (res) => res.status === 200 || res.status === 307 || res.status === 308),
  check("Listing page", `${web}/listing/${listingId}`, (res) => res.status === 200),
];

const results = [];
for (const pending of checks) {
  results.push(await pending);
}
const report = {
  api,
  web,
  ranAt: new Date().toISOString(),
  passed: results.filter((r) => r.pass).length,
  failed: results.filter((r) => !r.pass).length,
  results,
};
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exit(1);

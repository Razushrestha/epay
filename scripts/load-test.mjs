/**
 * M4 load test against §10.3 targets:
 * API p95 < 300ms, search p95 < 400ms.
 * Usage: npm run test:load
 * Env: API_URL, CONCURRENCY (default 12), REQUESTS (default 96)
 */
const base = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
const concurrency = Math.max(1, Number(process.env.CONCURRENCY || 12));
const total = Math.max(concurrency, Number(process.env.REQUESTS || 96));
const strict = process.env.LOAD_TEST_STRICT === "1";

const targets = {
  health: 300,
  listings: 300,
  search: 400,
  deals: 300,
  catalog: 300,
};

const paths = [
  { name: "health", path: "/health", target: targets.health },
  { name: "listings", path: "/api/v1/listings?limit=12&sort=best_match", target: targets.listings },
  { name: "search", path: "/api/v1/listings/search?q=phone&limit=12", target: targets.search },
  { name: "deals", path: "/api/v1/listings/deals?limit=6", target: targets.deals },
  { name: "catalog", path: "/api/v1/catalog/categories?level=1", target: targets.catalog },
];

function pct(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

async function hit(path) {
  const started = Date.now();
  try {
    const res = await fetch(`${base}${path}`, { headers: { accept: "application/json" } });
    return { ok: res.ok, ms: Date.now() - started, status: res.status };
  } catch {
    return { ok: false, ms: Date.now() - started, status: 0 };
  }
}

async function runGroup(group) {
  const times = [];
  let fail = 0;
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, total) }, async () => {
    while (next < total) {
      const i = next;
      next += 1;
      if (i >= total) return;
      const result = await hit(group.path);
      times.push(result.ms);
      if (!result.ok) fail += 1;
    }
  });
  await Promise.all(workers);
  times.sort((a, b) => a - b);
  const p95 = pct(times, 0.95);
  return {
    name: group.name,
    path: group.path,
    requests: times.length,
    failed: fail,
    avgMs: Math.round(times.reduce((s, x) => s + x, 0) / Math.max(1, times.length)),
    p50Ms: pct(times, 0.5),
    p95Ms: p95,
    p99Ms: pct(times, 0.99),
    targetMs: group.target,
    pass: fail === 0 && p95 <= group.target,
  };
}

const started = Date.now();
const groups = [];
for (const group of paths) {
  groups.push(await runGroup(group));
}
const report = {
  base,
  concurrency,
  requestsPerEndpoint: total,
  elapsedMs: Date.now() - started,
  groups,
  pass: groups.every((g) => g.pass),
};
console.log(JSON.stringify(report, null, 2));
if (strict && !report.pass) process.exit(1);
if (groups.some((g) => g.failed)) process.exit(1);

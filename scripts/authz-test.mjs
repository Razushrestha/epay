/**
 * Authorization (IDOR / privilege) test against a RUNNING API.
 *
 *   node scripts/authz-test.mjs                 # read-only probes (safe)
 *   AUTHZ_MUTATING=1 node scripts/authz-test.mjs  # also tries cancel/ship/... on other users' orders
 *
 * Creates two throw-away accounts (A, B) and verifies that:
 *   1. anonymous callers get 401 on private + admin routes
 *   2. a normal signed-in user gets 403 on every admin route and cannot claim admin
 *   3. user B cannot read user A's addresses/orders/payments (IDOR)
 * Env: API_URL (default http://localhost:4000)
 */
import "dotenv/config";

const api = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
const mutating = process.env.AUTHZ_MUTATING === "1";
const stamp = Date.now();
const password = "AuthzTest1!x";
let failures = 0;

function report(ok, name, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function call(method, path, { token, body, ua = "authz-test" } = {}) {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: {
      "user-agent": ua,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json, text };
}

async function newUser(label) {
  const email = `authz-${label}-${stamp}@nexlo.test`;
  const ua = `authz-${label}-${stamp}`;
  const reg = await call("POST", "/api/v1/auth/register", {
    ua,
    body: { email, password, firstName: "Authz", lastName: label, accountType: "personal", displayName: `authz${label}` },
  });
  if (reg.status !== 201) throw new Error(`register ${label} failed: ${reg.status} ${reg.text.slice(0, 120)}`);
  let token = reg.json.token;
  if (!token) {
    const code = reg.json.data?.devCode;
    if (!code) throw new Error(`register ${label}: no token or devCode (run against a dev API)`);
    const verified = await call("POST", "/api/v1/auth/verify", { ua, body: { identifier: email, code } });
    token = verified.json.token;
  }
  if (!token) throw new Error(`could not obtain token for ${label}`);
  return { email, token, ua };
}

const denied = (status) => status === 401 || status === 403 || status === 404;

// --- 1. anonymous access ---------------------------------------------------------------
const privateGets = [
  "/api/v1/account",
  "/api/v1/account/addresses",
  "/api/v1/account/sessions",
  "/api/v1/orders",
  "/api/v1/orders/selling",
  "/api/v1/messages",
  "/api/v1/wallet",
  "/api/v1/notifications",
];
const adminGets = [
  "audit", "cms", "cms/banners", "cms/pages", "cms/settings", "disputes", "finance", "kyc", "ledger", "listings",
  "messages", "moderation", "orders", "overview", "payouts", "refunds", "reviews", "roles", "settings", "strikes",
  "tickets", "trust", "uat", "users", "appeals", "queues/stream",
].map((p) => `/api/v1/admin/${p}`);

for (const path of [...privateGets, ...adminGets]) {
  const r = await call("GET", path);
  report(r.status === 401 || r.status === 403, `anonymous GET ${path} -> 401/403`, `got ${r.status}`);
}
{
  const r = await call("GET", "/api/v1/payments/status/1");
  report(r.status === 401, "anonymous GET /payments/status/1 -> 401", `got ${r.status}`);
}

// --- 2. two accounts -------------------------------------------------------------------
const A = await newUser("a");
const B = await newUser("b");

for (const path of adminGets.filter((p) => !p.endsWith("/stream"))) {
  const r = await call("GET", path, { token: B.token, ua: B.ua });
  report(r.status === 403, `normal user GET ${path} -> 403`, `got ${r.status}`);
}
{
  const claim = await call("POST", "/api/v1/admin/claim", { token: B.token, ua: B.ua, body: { secret: "NEXLO_ADMIN_2026" } });
  report(denied(claim.status), "normal user cannot claim super admin (even with the old default secret)", `got ${claim.status}`);
  const status = await call("GET", "/api/v1/admin/status", { token: B.token, ua: B.ua });
  report(status.json.youAreStaff !== true, "claim attempt did not make user staff", `youAreStaff=${status.json.youAreStaff}`);
}
for (const body of [{ role: "super_admin" }, { is_staff: true, staff_role: "super_admin" }, { isStaff: true }]) {
  await call("PATCH", "/api/v1/account/profile", { token: B.token, ua: B.ua, body });
}
{
  const status = await call("GET", "/api/v1/admin/status", { token: B.token, ua: B.ua });
  report(status.json.youAreStaff !== true, "mass-assignment via profile PATCH cannot grant staff", `youAreStaff=${status.json.youAreStaff}`);
}

// --- 3. cross-user data access (IDOR) --------------------------------------------------
{
  const created = await call("POST", "/api/v1/account/addresses", {
    token: A.token,
    ua: A.ua,
    body: {
      label: "Home", fullName: "Authz A", line1: "1 Secret Street", city: "Kathmandu", region: "Bagmati",
      postalCode: "44600", country: "NP", phone: "9800000000",
    },
  });
  const listB = await call("GET", "/api/v1/account/addresses", { token: B.token, ua: B.ua });
  report(!JSON.stringify(listB.json).includes("1 Secret Street"), "user B cannot see user A's address", `create=${created.status}`);
}

// Real orders/payments in the database (read-only probes by an unrelated user).
let sample = { orders: [], payments: [] };
try {
  const { query } = await import("../server/db.mjs");
  const { initDb } = await import("../server/db.mjs");
  await initDb();
  sample.orders = (await query(`SELECT id, order_number FROM orders ORDER BY id DESC LIMIT 5`)).rows;
  sample.payments = (await query(`SELECT id FROM payments ORDER BY id DESC LIMIT 3`)).rows;
} catch (err) {
  console.log(`SKIP  database sampling (${err.message}); using synthetic ids`);
  sample.orders = [{ id: 1 }];
}

for (const o of sample.orders) {
  for (const suffix of ["", "/invoice"]) {
    const r = await call("GET", `/api/v1/orders/${o.id}${suffix}`, { token: B.token, ua: B.ua });
    const leaked = r.status === 200 && Object.keys(r.json).length > 0;
    report(!leaked, `user B cannot GET /orders/${o.id}${suffix}`, `got ${r.status}`);
  }
}
for (const p of sample.payments) {
  const r = await call("GET", `/api/v1/payments/status/${p.id}`, { token: B.token, ua: B.ua });
  report(r.status !== 200 || !r.json?.payment, `user B cannot GET /payments/status/${p.id}`, `got ${r.status}`);
}

if (mutating) {
  for (const o of sample.orders.slice(0, 2)) {
    for (const action of ["cancel", "ship", "deliver", "complete"]) {
      const r = await call("POST", `/api/v1/orders/${o.id}/${action}`, { token: B.token, ua: B.ua, body: {} });
      report(denied(r.status) || r.status === 400 || r.status === 409, `user B cannot ${action} order ${o.id}`, `got ${r.status}`);
    }
  }
} else {
  console.log("SKIP  mutating order probes (set AUTHZ_MUTATING=1 to enable)");
}

console.log(failures ? `\n${failures} authorization check(s) FAILED` : "\nAll authorization checks passed");
process.exit(failures ? 1 : 0);

/**
 * Live functional smoke: public APIs, auth, account, passkeys, donations,
 * listings, cart, bot rate-limit, and storefront pages.
 * Usage: node scripts/functional-smoke.mjs
 * Env: API_URL, FRONTEND_URL
 */
const api = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
const web = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const origin = web;

const results = [];
const stamp = Date.now();
const email = `smoke${stamp}@nexlo.test`;
const password = "SmokeTest1!";
const botIp = `203.0.113.${(stamp % 200) + 1}`;

function record(name, pass, detail = "") {
  results.push({ name, pass, detail: String(detail).slice(0, 240) });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(method, path, { token, body, headers = {}, expectStatus } = {}) {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-session-id": `smoke${stamp}`,
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 120) };
  }
  if (expectStatus != null && res.status !== expectStatus) {
    const err = new Error(`${method} ${path} expected ${expectStatus} got ${res.status} ${json.error || ""}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return { status: res.status, json, headers: res.headers };
}

async function page(name, path, ok = (status) => status === 200) {
  try {
    const res = await fetch(`${web}${path}`, { redirect: "manual" });
    record(name, ok(res.status), String(res.status));
  } catch (err) {
    record(name, false, err instanceof Error ? err.message : "failed");
  }
}

async function check(name, fn) {
  try {
    const detail = await fn();
    record(name, true, detail ?? "");
  } catch (err) {
    record(name, false, err instanceof Error ? err.message : String(err));
  }
}

await check("API health + database", async () => {
  const { json } = await req("GET", "/health", { expectStatus: 200 });
  if (json.database !== "connected") throw new Error(`database ${json.database}`);
  return json.database;
});

await check("Catalog categories", async () => {
  const { json } = await req("GET", "/api/v1/catalog/categories?level=1", { expectStatus: 200 });
  const rows = json.categories || json.data || [];
  if (!rows.length) throw new Error("no categories");
  return `${rows.length} categories`;
});

await check("Catalog conditions", async () => {
  const { json } = await req("GET", "/api/v1/catalog/conditions", { expectStatus: 200 });
  if (!json.conditions?.length) throw new Error("no conditions");
  return String(json.conditions.length);
});

await check("Catalog brands", async () => {
  const { json } = await req("GET", "/api/v1/catalog/brands?limit=10", { expectStatus: 200 });
  return `${(json.brands || []).length} brands`;
});

await check("Browse listings", async () => {
  const { json } = await req("GET", "/api/v1/listings?limit=8", { expectStatus: 200 });
  return `${json.listings?.length || 0} of ${json.total ?? "?"}`;
});

await check("Search listings", async () => {
  await req("GET", "/api/v1/listings/search?q=a&limit=8", { expectStatus: 200 });
});

await check("Deals + featured + suggest", async () => {
  await req("GET", "/api/v1/listings/deals?limit=6", { expectStatus: 200 });
  await req("GET", "/api/v1/listings/featured", { expectStatus: 200 });
  await req("GET", "/api/v1/listings/suggest?q=ph", { expectStatus: 200 });
});

await check("Help + banners public", async () => {
  await req("GET", "/api/v1/help", { expectStatus: 200 });
  await req("GET", "/api/v1/site/banners", { expectStatus: 200 });
});

await check("Unknown route 404", async () => {
  await req("GET", "/api/v1/nonexistent", { expectStatus: 404 });
});

await check("Auth guards (unauthenticated)", async () => {
  await req("GET", "/api/v1/account", { expectStatus: 401 });
  await req("GET", "/api/v1/account/passkeys", { expectStatus: 401 });
  await req("GET", "/api/v1/listings/watchlist", { expectStatus: 401 });
  await req("GET", "/api/v1/orders", { expectStatus: 401 });
  await req("GET", "/api/v1/wallet", { expectStatus: 401 });
  await req("GET", "/api/v1/admin/users", { expectStatus: 401 });
  await req("POST", "/api/v1/listings", { body: { title: "x" }, expectStatus: 401 });
});

await check("Guest cart allowed", async () => {
  const { json } = await req("GET", "/api/v1/cart", { expectStatus: 200 });
  return `${json.sellers?.length ?? 0} sellers`;
});

await check("Invalid login 401", async () => {
  await req("POST", "/api/v1/auth/login", {
    body: { identifier: "nobody@nexlo.test", password: "wrong-password" },
    expectStatus: 401,
  });
});

await check("Invalid register 400", async () => {
  await req("POST", "/api/v1/auth/register", {
    body: { email: "not-an-email", password: "short" },
    expectStatus: 400,
  });
});

let token = "";
let listingId = null;
let skuId = null;

await check("Register business seller", async () => {
  const { json } = await req("POST", "/api/v1/auth/register", {
    body: {
      email,
      password,
      firstName: "Smoke",
      lastName: "Bot",
      accountType: "business",
      displayName: "Smoke Seller",
    },
    expectStatus: 201,
  });
  if (!json.token) throw new Error("no session token");
  token = json.token;
  return email;
});

await check("Login with password", async () => {
  const { json } = await req("POST", "/api/v1/auth/login", {
    body: { identifier: email, password, remember: true },
    expectStatus: 200,
  });
  if (!json.token) throw new Error("login did not return a token");
  token = json.token;
});

await check("Account profile", async () => {
  const { json } = await req("GET", "/api/v1/account", { token, expectStatus: 200 });
  if (!json.user) throw new Error("missing user");
  return json.user.email || json.user.displayName || "ok";
});

await check("Account addresses + sessions + consents", async () => {
  await req("GET", "/api/v1/account/addresses", { token, expectStatus: 200 });
  await req("GET", "/api/v1/account/sessions", { token, expectStatus: 200 });
  await req("GET", "/api/v1/account/consents", { token, expectStatus: 200 });
});

await check("Passkeys list + registration options", async () => {
  const list = await req("GET", "/api/v1/account/passkeys", { token, expectStatus: 200 });
  const started = await req("POST", "/api/v1/account/passkeys/options", { token, body: {}, expectStatus: 200 });
  if (!started.json.options?.rp?.id || !started.json.challengeToken) {
    throw new Error("missing WebAuthn options");
  }
  await req("POST", "/api/v1/auth/passkeys/options", { body: { identifier: email }, expectStatus: 200 });
  await req("POST", "/api/v1/auth/passkeys", {
    body: { challengeToken: "deadbeef", response: { id: "x" } },
    expectStatus: 401,
  });
  return `${(list.json.data || []).length} saved, rp ${started.json.options.rp.id}`;
});

await check("Donation prefs", async () => {
  const got = await req("GET", "/api/v1/account/donations", { token, expectStatus: 200 });
  const charityId = got.json.charities?.[0]?.id;
  if (!charityId) throw new Error("no charities seeded");
  const saved = await req("PUT", "/api/v1/account/donations", {
    token,
    body: { enabled: true, charityId },
    expectStatus: 200,
  });
  if (!saved.json.prefs?.enabled) throw new Error("pref not saved");
  return saved.json.charities[0].name;
});

await check("Orders / messages / notifications / tickets / wallet", async () => {
  await req("GET", "/api/v1/orders", { token, expectStatus: 200 });
  await req("GET", "/api/v1/messages", { token, expectStatus: 200 });
  await req("GET", "/api/v1/notifications", { token, expectStatus: 200 });
  await req("GET", "/api/v1/tickets", { token, expectStatus: 200 });
  await req("GET", "/api/v1/wallet", { token, expectStatus: 200 });
  await req("GET", "/api/v1/seller/dashboard", { token, expectStatus: 200 });
});

await check("Create variation listing", async () => {
  const cats = await req("GET", "/api/v1/catalog/categories?level=1", { expectStatus: 200 });
  const conds = await req("GET", "/api/v1/catalog/conditions", { expectStatus: 200 });
  const categoryId = cats.json.categories?.[0]?.id;
  const conditionId = conds.json.conditions?.[0]?.id;
  if (!categoryId) throw new Error("need a category");
  const created = await req("POST", "/api/v1/listings", {
    token,
    body: {
      category_id: categoryId,
      condition_id: conditionId,
      title: `Smoke variation ${stamp}`,
      description: "Functional smoke listing with size and color SKUs.",
      format: "fixed",
      price: 500,
      quantity: 3,
      shipping_free: true,
      publish_immediately: true,
      variations: [
        { name: "Size", values: ["S", "M"] },
        { name: "Color", values: ["Red"] },
      ],
      skus: [
        { combination: { Size: "S", Color: "Red" }, price: 500, quantity: 2, sku: `SMK-S-${stamp}` },
        { combination: { Size: "M", Color: "Red" }, price: 520, quantity: 1, sku: `SMK-M-${stamp}` },
      ],
    },
  });
  if (created.status !== 201) {
    throw new Error(`${created.status} ${created.json.error || "create failed"}`);
  }
  listingId = created.json.listing?.id;
  const detail = await req("GET", `/api/v1/listings/${listingId}`, { expectStatus: 200 });
  const skus = detail.json.listing?.skus || [];
  skuId = skus[0]?.id;
  if (skus.length < 2) throw new Error(`expected 2 SKUs, got ${skus.length}`);
  return `listing ${listingId}, ${skus.length} SKUs`;
});

await check("Watchlist add/list", async () => {
  if (!listingId) throw new Error("no listing");
  await req("POST", `/api/v1/listings/${listingId}/watch`, { token, expectStatus: 200 });
  const list = await req("GET", "/api/v1/listings/watchlist", { token, expectStatus: 200 });
  return `${(list.json.listings || list.json.data || []).length} watched`;
});

await check("Cart add + calculate donation round-up", async () => {
  if (!listingId) throw new Error("no listing");
  const buyerEmail = `buyer${stamp}@nexlo.test`;
  const buyer = await req("POST", "/api/v1/auth/register", {
    body: { email: buyerEmail, password, firstName: "Smoke", lastName: "Buyer" },
    expectStatus: 201,
  });
  const buyerToken = buyer.json.token;
  await req("PUT", "/api/v1/account/donations", {
    token: buyerToken,
    body: { enabled: true },
    expectStatus: 200,
  });
  const added = await req("POST", "/api/v1/cart", {
    token: buyerToken,
    body: { listing_id: listingId, variation_sku_id: skuId, quantity: 1 },
  });
  if (added.status !== 200 && added.status !== 201) {
    throw new Error(`${added.status} ${added.json.error || "add failed"}`);
  }
  const calc = await req("POST", "/api/v1/cart/checkout/calculate", {
    token: buyerToken,
    body: { donate: true },
    expectStatus: 200,
  });
  const subtotal = Number(calc.json.subtotal || 0);
  const donation = Number(calc.json.donation ?? calc.json.donation_amount ?? 0);
  if (subtotal <= 0) throw new Error(`empty cart totals ${JSON.stringify(calc.json)}`);
  if (!(donation > 0)) throw new Error(`expected round-up donation, got ${calc.json.donation}`);
  return `subtotal ${subtotal} donation ${donation}`;
});

await check("Auction snapshot for listing", async () => {
  const id = listingId || 6;
  const { status } = await req("GET", `/api/v1/auctions/${id}`);
  if (![200, 404].includes(status)) throw new Error(`unexpected ${status}`);
  return String(status);
});

await check("Bot brute-force blocked (429)", async () => {
  const headers = {
    "X-Forwarded-For": botIp,
    "User-Agent": `NexloSmokeBot/${stamp}`,
  };
  const statuses = [];
  for (let i = 0; i < 21; i += 1) {
    const { status } = await req("POST", "/api/v1/auth/login", {
      headers,
      body: { identifier: `bot${stamp}@nexlo.test`, password: "wrong-password" },
    });
    statuses.push(status);
  }
  const blocked = statuses.filter((code) => code === 429).length;
  if (!blocked) throw new Error(`no 429 after 21 attempts: ${statuses.slice(-5).join(",")}`);
  return `429 after ${statuses.findIndex((code) => code === 429) + 1} attempts`;
});

await page("Home", "/");
await page("Search page", "/search");
await page("Deals page", "/deals");
await page("Help", "/help");
await page("Login", "/login");
await page("Register", "/register");
await page("Watchlist", "/watchlist");
await page("Cart page", "/cart");
await page("Checkout", "/checkout");
await page("Buyer protection", "/buyer-protection");
await page("Resolution", "/resolution", (status) => [200, 307, 308].includes(status));
await page("Unknown page 404", "/this-page-does-not-exist", (status) => status === 404);
if (listingId) {
  await page("Listing PDP", `/listing/${listingId}`);
}

const passed = results.filter((row) => row.pass).length;
const failed = results.filter((row) => !row.pass).length;
const report = { api, web, ranAt: new Date().toISOString(), passed, failed, results };
console.log(JSON.stringify({ passed, failed, ranAt: report.ranAt }, null, 2));
if (failed) process.exit(1);

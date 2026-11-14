/**
 * End-to-end check of the admin catalog (categories + brands) against a running API.
 * Mints a short-lived staff session for an existing staff user, exercises create / edit / hide /
 * delete, checks that sellers only see active categories, then removes everything it created.
 *
 *   node scripts/catalog-admin-test.mjs            (API on http://localhost:4000)
 */
import "dotenv/config";
import crypto from "node:crypto";
import { query } from "../server/db.mjs";

const API = process.env.API_URL || "http://localhost:4000";
let failed = 0;

function ok(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failed += 1;
}

async function call(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const staff = await query(
  `SELECT id FROM users WHERE is_staff = TRUE AND staff_role = 'super_admin' ORDER BY id LIMIT 1`,
);
if (!staff.rows[0]) {
  console.log("SKIP  no super_admin account to borrow a session from");
  process.exit(0);
}

const token = `catalog-test-${crypto.randomBytes(16).toString("hex")}`;
const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
const sessionCols = await query(
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'auth_sessions'`,
);
const names = new Set(sessionCols.rows.map((r) => r.column_name));
const cols = ["user_id", "token_hash", "expires_at"];
const vals = [staff.rows[0].id, tokenHash, new Date(Date.now() + 15 * 60 * 1000)];
if (names.has("public_id")) {
  cols.push("public_id");
  vals.push(crypto.randomUUID());
}
if (names.has("created_at")) {
  cols.push("created_at");
  vals.push(new Date());
}
const session = await query(
  `INSERT INTO auth_sessions (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
  vals,
);

const stamp = Date.now().toString(36);
let categoryId;
let childId;
let brandId;

try {
  // --- access control
  const anon = await call("POST", "/api/v1/catalog/admin/categories", null, { name: "x", slug: "x" });
  ok("anonymous cannot create a category", anon.status === 401 || anon.status === 403, `got ${anon.status}`);
  const anonBrands = await call("GET", "/api/v1/catalog/admin/brands", null);
  ok("anonymous cannot read the admin brand list", anonBrands.status === 401 || anonBrands.status === 403, `got ${anonBrands.status}`);

  // --- category lifecycle
  const created = await call("POST", "/api/v1/catalog/admin/categories", token, {
    name: `Zz Test ${stamp}`,
    slug: `zz-test-${stamp}`,
    icon: "🧪",
  });
  categoryId = created.json.category?.id;
  ok("admin creates a category", created.status === 201 && Boolean(categoryId), `status ${created.status}`);

  const child = await call("POST", "/api/v1/catalog/admin/categories", token, {
    name: `Zz Child ${stamp}`,
    slug: `zz-child-${stamp}`,
    parent_id: categoryId,
  });
  childId = child.json.category?.id;
  ok("admin creates a subcategory", child.status === 201 && child.json.category?.level === 2);

  const edited = await call("PATCH", `/api/v1/catalog/admin/categories/${categoryId}`, token, {
    name: `Zz Renamed ${stamp}`,
    icon: "🔬",
    description: "edited by test",
    requires_approval: true,
  });
  ok(
    "admin edits name / icon / description / approval",
    edited.status === 200 &&
      edited.json.category?.name === `Zz Renamed ${stamp}` &&
      edited.json.category?.icon === "🔬" &&
      edited.json.category?.requires_approval === true,
  );

  const clash = await call("PATCH", `/api/v1/catalog/admin/categories/${categoryId}`, token, { slug: "coins" });
  ok("duplicate slug is rejected with 409, not 500", clash.status === 409, `got ${clash.status}`);

  let tree = await call("GET", "/api/v1/catalog/categories/tree");
  const flat = (nodes) => nodes.flatMap((n) => [n, ...flat(n.children || [])]);
  ok("new category is visible in the public tree (seller form + menu)", flat(tree.json.tree).some((n) => n.id === categoryId));

  const listed = await call("GET", "/api/v1/catalog/categories?level=1");
  ok("level-1 list contains the new category", (listed.json.categories || []).some((c) => c.id === categoryId));

  const blocked = await call("DELETE", `/api/v1/catalog/admin/categories/${categoryId}`, token);
  ok("cannot delete a category that still has subcategories", blocked.status === 400, `got ${blocked.status}`);

  // --- hide / sellers can no longer pick it
  await call("PATCH", `/api/v1/catalog/admin/categories/${categoryId}`, token, { is_active: false });
  tree = await call("GET", "/api/v1/catalog/categories/tree");
  ok("hidden category disappears from the public tree", !flat(tree.json.tree).some((n) => n.id === categoryId));
  await call("PATCH", `/api/v1/catalog/admin/categories/${categoryId}`, token, { is_active: true });

  // --- brand lifecycle
  const brand = await call("POST", "/api/v1/catalog/admin/brands", token, {
    name: `Zz Brand ${stamp}`,
    slug: `zz-brand-${stamp}`,
  });
  brandId = brand.json.brand?.id;
  ok("admin creates a brand", brand.status === 201 && Boolean(brandId));

  const brandEdit = await call("PATCH", `/api/v1/catalog/admin/brands/${brandId}`, token, {
    name: `Zz Brand Renamed ${stamp}`,
    website: "https://example.com",
    is_verified: true,
  });
  ok(
    "admin edits a brand",
    brandEdit.status === 200 && brandEdit.json.brand?.is_verified === true && brandEdit.json.brand?.website === "https://example.com",
  );

  await call("PATCH", `/api/v1/catalog/admin/brands/${brandId}`, token, { is_active: false });
  const publicBrands = await call("GET", "/api/v1/catalog/brands?limit=200");
  ok("hidden brand is not offered to sellers", !(publicBrands.json.brands || []).some((b) => b.id === brandId));
  const adminBrands = await call("GET", "/api/v1/catalog/admin/brands?limit=200", token);
  ok("hidden brand still shows in the admin list", (adminBrands.json.brands || []).some((b) => b.id === brandId));

  const brandClash = await call("PATCH", `/api/v1/catalog/admin/brands/${brandId}`, token, {
    name: (publicBrands.json.brands || [])[0]?.name || "Apple",
  });
  ok("duplicate brand name is rejected with 409", brandClash.status === 409 || publicBrands.json.brands?.length === 0, `got ${brandClash.status}`);

  // --- seller rule: only active categories can be listed in
  const { assertSellableCategory } = await import("../server/catalog.mjs");
  await call("PATCH", `/api/v1/catalog/admin/categories/${categoryId}`, token, { is_active: false });
  const hiddenPick = await assertSellableCategory(categoryId);
  ok("seller cannot list in a hidden category", hiddenPick?.status === 400, hiddenPick?.body?.error);
  await call("PATCH", `/api/v1/catalog/admin/categories/${categoryId}`, token, { is_active: true });
  const visiblePick = await assertSellableCategory(categoryId);
  ok("seller can list in a visible category", visiblePick === null);
  const missingPick = await assertSellableCategory(99999999);
  ok("seller cannot list in a category that does not exist", missingPick?.status === 400);

  // --- existing brands are kept
  ok("existing brands are still present", (adminBrands.json.brands || []).length > 1, `${adminBrands.json.brands?.length} brands`);
} finally {
  const created = [categoryId, childId].filter(Boolean);
  if (created.length) {
    await query("DELETE FROM category_audit_log WHERE category_id = ANY($1::int[])", [created]).catch(() => {});
    await query("DELETE FROM category_fees WHERE category_id = ANY($1::int[])", [created]).catch(() => {});
    if (childId) await query("DELETE FROM categories WHERE id = $1", [childId]).catch(() => {});
    if (categoryId) await query("DELETE FROM categories WHERE id = $1", [categoryId]).catch(() => {});
  }
  if (brandId) await query("DELETE FROM brands WHERE id = $1", [brandId]).catch(() => {});
  await query("DELETE FROM auth_sessions WHERE id = $1", [session.rows[0].id]).catch(() => {});
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll catalog admin checks passed");
process.exit(failed ? 1 : 0);

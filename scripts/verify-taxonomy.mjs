// Verifies the taxonomy through the public API (needs the API running).
//   node scripts/verify-taxonomy.mjs
const api = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
let failures = 0;
const check = (ok, name, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const get = async (path) => (await fetch(`${api}${path}`)).json();

const { tree } = await get("/api/v1/catalog/categories/tree");
const roots = tree.map((n) => n.name);
check(roots.length === 10, "exactly 10 top-level categories are visible", roots.join(" | "));

const expected = [
  "Banknotes & Coins", "Stamps", "Medals & Tokens", "Antiques & Collectibles", "Trading Cards",
  "Image & Video Rights", "Autographed Items", "Special / Limited Edition Items", "Luxury Items", "Others",
];
check(JSON.stringify(roots) === JSON.stringify(expected), "top-level order matches the client's list");

const find = (nodes, slug) => {
  for (const n of nodes) {
    if (n.slug === slug) return n;
    const hit = find(n.children || [], slug);
    if (hit) return hit;
  }
  return null;
};
const names = (slug) => (find(tree, slug)?.children || []).map((c) => c.name).join(", ");

check(names("banknotes-coins") === "Coins, Banknotes", "Banknotes & Coins -> Coins, Banknotes", names("banknotes-coins"));
check(names("coins") === "National, International", "Coins -> National, International");
check(names("banknotes") === "National, International", "Banknotes -> National, International");
check(names("stamps") === "National, International", "Stamps -> National, International");
check(names("medals-tokens") === "National, International", "Medals & Tokens -> National, International");
check(names("image-video-rights") === "Image, Video", "Image & Video Rights -> Image, Video");
check(names("autographed-items") === "Certified, Normal", "Autographed -> Certified, Normal");
check(names("luxury-items") === "Watches, Shoes, Bags, Ornaments, Jerseys, Others", "Luxury -> Watches, Shoes, Bags, Ornaments, Jerseys, Others");
check(names("others") === "Homes, Land, Bikes, Cars, Other Items", "Others -> Homes, Land, Bikes, Cars, Other Items");

// Conditions: coin grades only for Banknotes & Coins (and descendants)
const grades = ["Circulated", "Extra Fine", "AUNC", "UNC"];
for (const slug of ["banknotes-coins", "coins", "coins-national", "banknotes-international"]) {
  const body = await get(`/api/v1/catalog/conditions?category_id=${find(tree, slug).id}`);
  check(JSON.stringify(body.conditions.map((c) => c.name)) === JSON.stringify(grades), `conditions for ${slug} are the coin grades`);
}
for (const slug of ["stamps", "luxury-watches", "others-cars"]) {
  const body = await get(`/api/v1/catalog/conditions?category_id=${find(tree, slug).id}`);
  const list = body.conditions.map((c) => c.name);
  check(!list.some((n) => grades.includes(n)) && list.includes("New"), `conditions for ${slug} are the generic list (no coin grades)`);
}
{
  const body = await get("/api/v1/catalog/conditions");
  check(!body.conditions.some((c) => grades.includes(c.name)), "default (no category) condition list has no coin grades");
}

// Attributes: every node must carry a real pack (not the generic electronics defaults)
const generic = new Set(["brand", "model", "color", "size", "storage"]);
const allNodes = [];
(function walk(nodes) { for (const n of nodes) { allNodes.push(n); walk(n.children || []); } })(tree);
let bad = 0;
for (const node of allNodes) {
  const { specifics } = await get(`/api/v1/catalog/categories/${node.id}/specifics`);
  const slugs = (specifics || []).map((s) => s.slug);
  if (!slugs.length || slugs.some((s) => generic.has(s))) {
    bad += 1;
    console.log(`  problem: ${node.slug} -> [${slugs.join(", ")}]`);
  }
}
check(bad === 0, `all ${allNodes.length} categories have their own attributes (no generic defaults)`);

const cars = await get(`/api/v1/catalog/categories/${find(tree, "others-cars").id}/specifics`);
check(cars.specifics.map((s) => s.slug).includes("vehicle-mileage"), "Cars has vehicle attributes");
const stamps = await get(`/api/v1/catalog/categories/${find(tree, "stamps").id}/specifics`);
const status = stamps.specifics.find((s) => s.slug === "stamp-status");
check(JSON.stringify(status?.options?.map((o) => o.value)) === JSON.stringify(["Used", "New", "Special Edition"]), "Stamps has Used / New / Special Edition");

console.log(failures ? `\n${failures} check(s) FAILED` : "\nTaxonomy verified");
process.exit(failures ? 1 : 0);

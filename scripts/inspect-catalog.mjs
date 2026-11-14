// Read-only: prints the current category tree, conditions and listing counts.
import "dotenv/config";
const { query, initDb } = await import("../server/db.mjs");
await initDb();

const cats = await query(
  `SELECT c.id, c.name, c.slug, c.parent_id, c.level, c.lft, c.rgt, c.is_active, c.sort_order,
          (SELECT COUNT(*)::int FROM listings l WHERE l.category_id = c.id) AS listings
   FROM categories c ORDER BY c.lft`,
);
console.log("CATEGORIES", cats.rows.length);
for (const r of cats.rows) console.log(JSON.stringify(r));

const cond = await query(`SELECT id, name, slug, is_active FROM conditions ORDER BY sort_order`);
console.log("CONDITIONS");
for (const r of cond.rows) console.log(JSON.stringify(r));

const cc = await query(`SELECT COUNT(*)::int AS c FROM category_conditions`);
console.log("category_conditions rows", cc.rows[0].c);

for (const table of ["categories", "listings", "conditions", "item_specifics"]) {
  const cols = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
    [table],
  );
  console.log(`${table} cols:`, cols.rows.map((r) => r.column_name).join(","));
}
process.exit(0);

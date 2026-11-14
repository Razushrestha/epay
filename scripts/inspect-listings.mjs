/** Read-only: how many listings exist, in which states, and which are publicly visible. */
import "dotenv/config";
import { query } from "../server/db.mjs";

const byState = await query(
  `SELECT l.status, l.moderation_status, c.is_active AS category_active, COUNT(*)::int AS n
   FROM listings l LEFT JOIN categories c ON c.id = l.category_id
   GROUP BY 1,2,3 ORDER BY n DESC`,
);
console.log("status / moderation / category_active / count");
for (const r of byState.rows) console.log(`${r.status}\t${r.moderation_status}\t${r.category_active}\t${r.n}`);

const byCat = await query(
  `SELECT c.name, c.is_active, COUNT(*)::int AS n FROM listings l JOIN categories c ON c.id = l.category_id GROUP BY 1,2 ORDER BY n DESC LIMIT 15`,
);
console.log("\nper category");
for (const r of byCat.rows) console.log(`${r.name}\tactive=${r.is_active}\t${r.n}`);

const cols = await query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='listings' AND column_name IN ('is_featured','compare_at','promoted_until','deleted_at')`,
);
console.log("\ncolumns:", cols.rows.map((r) => r.column_name).join(", "));
process.exit(0);

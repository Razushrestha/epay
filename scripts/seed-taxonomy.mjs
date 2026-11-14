/**
 * Seed the client's collectibles taxonomy (categories, attributes, coin grades).
 *
 *   node scripts/seed-taxonomy.mjs                 # add what is missing (safe, idempotent)
 *   node scripts/seed-taxonomy.mjs --retire-old    # also HIDE the previous top-level categories
 *   node scripts/seed-taxonomy.mjs --restore-old   # show the previous categories again
 *   node scripts/seed-taxonomy.mjs --dry-run       # run everything, print the result, ROLL BACK
 *
 * Nothing is deleted; listings keep their category ids either way.
 */
import "dotenv/config";
import { initDb } from "../server/db.mjs";
import { seedTaxonomy, restoreOldCategories, describeTaxonomy } from "../server/catalog-taxonomy.mjs";

const args = new Set(process.argv.slice(2));
await initDb();

if (args.has("--restore-old")) {
  const touched = await restoreOldCategories();
  console.log(`restored ${touched} previous categories`);
} else {
  const dryRun = args.has("--dry-run");
  const summary = await seedTaxonomy({ retireOld: args.has("--retire-old"), dryRun });
  const { preview, ...counts } = summary;
  console.log(dryRun ? "DRY RUN (rolled back, nothing saved):" : "taxonomy seeded:", counts);
  if (preview) {
    for (const row of preview) {
      console.log(`${"  ".repeat(row.level - 1)}${row.is_active ? "•" : "×"} ${row.name} [${row.slug}] attrs=${row.attributes}`);
    }
  }
}

if (!args.has("--dry-run")) {
  for (const row of await describeTaxonomy()) {
    const indent = "  ".repeat(row.level - 1);
    console.log(`${indent}${row.is_active ? "•" : "×"} ${row.name} [${row.slug}] attrs=${row.attributes}`);
  }
}
process.exit(0);

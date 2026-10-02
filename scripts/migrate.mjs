import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import "dotenv/config";
import { createPglitePool } from "../server/pglite-pool.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "database", "migrations");

const usePglite =
  process.env.USE_PGLITE === "1" ||
  process.env.DATABASE_URL?.startsWith("pglite:");

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://nexlo:nexlo@localhost:5433/nexlo";

async function createClient() {
  if (usePglite) {
    const pool = await createPglitePool();
    return {
      query: (text, params) => pool.query(text, params),
      exec: (sql) => pool.exec(sql),
      end: () => pool.end(),
    };
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  return {
    query: (text, params) => client.query(text, params),
    end: () => client.end(),
  };
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function appliedVersions(client) {
  const { rows } = await client.query(
    "SELECT version FROM schema_migrations ORDER BY version",
  );
  return new Set(rows.map((r) => r.version));
}

async function run() {
  const client = await createClient();
  if (usePglite) {
    console.log("using embedded PGLite (.data/pglite)");
  }
  await ensureMigrationsTable(client);
  const done = await appliedVersions(client);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (done.has(file)) {
      console.log(`skip ${file}`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`apply ${file}`);
    if (usePglite) {
      await client.exec(sql);
      await client.query(
        "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
        [file],
      );
    } else {
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
          [file],
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  }

  await client.end();
  console.log("migrations complete");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

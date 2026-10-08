import pg from "pg";
import { createPglitePool } from "./pglite-pool.mjs";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://nexlo:nexlo@localhost:5433/nexlo";

const usePglite =
  process.env.USE_PGLITE === "1" ||
  process.env.DATABASE_URL?.startsWith("pglite:");

/** @type {import('pg').Pool | Awaited<ReturnType<typeof createPglitePool>> | null} */
export let pool = null;

export async function initDb() {
  if (pool) return pool;
  if (usePglite) {
    pool = await createPglitePool();
    return pool;
  }
  pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
  });
  return pool;
}

export async function checkDb() {
  if (!pool) await initDb();
  const { rows } = await pool.query("SELECT 1 AS ok");
  return rows[0]?.ok === 1;
}

/**
 * Query helper function
 */
export async function query(text, params) {
  if (!pool) await initDb();
  return pool.query(text, params);
}

export async function withTx(fn) {
  if (!pool) await initDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

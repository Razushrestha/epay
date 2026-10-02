import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", ".data", "pglite");

export async function createPglitePool() {
  mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir);

  return {
    async exec(sql) {
      return db.exec(sql);
    },
    async query(text, params) {
      return db.query(text, params);
    },
    async connect() {
      return {
        query: (text, params) => db.query(text, params),
        release() {},
      };
    },
    async end() {
      await db.close();
    },
  };
}

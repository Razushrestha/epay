/**
 * Import this FIRST in any test that reads or writes the database.
 *
 * These tests create orders, payments and users. They used to run against whatever DATABASE_URL
 * `.env` pointed at (the live Neon database). They now only run against an explicit TEST_DATABASE_URL
 * and are skipped otherwise, so `npm test` can never touch production data.
 */
import "dotenv/config";

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  console.log("# skipped: database test (set TEST_DATABASE_URL to a disposable database to run it)");
  process.exit(0);
}

if (testUrl === process.env.DATABASE_URL) {
  console.error("# refusing to run: TEST_DATABASE_URL is the same as DATABASE_URL");
  process.exit(1);
}

process.env.DATABASE_URL = testUrl;

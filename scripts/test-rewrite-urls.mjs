// Tests deploy/vps/rewrite-image-urls.sql on a throw-away in-memory database (no Neon, no network).
// Usage: node scripts/test-rewrite-urls.mjs
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const OLD = "https://br-test.storage.c-7.us-east-2.aws.neon.tech/uploads/";
const db = new PGlite();
await db.exec(`
  CREATE TABLE listing_photos (id serial PRIMARY KEY, url text, thumbnail_url varchar(500));
  CREATE TABLE returns (id serial PRIMARY KEY, photos jsonb);
  CREATE TABLE notes (id serial PRIMARY KEY, body text);
  CREATE TABLE schema_migrations (version text PRIMARY KEY);
  INSERT INTO listing_photos (url, thumbnail_url) VALUES
    ('${OLD}listings/a.jpg', '${OLD}listings/thumb-a.jpg'),
    ('/uploads/listings/already-local.jpg', NULL),
    ('https://images.unsplash.com/photo-1', NULL);
  INSERT INTO returns (photos) VALUES ('["${OLD}returns/1.jpg", "https://example.com/x.jpg"]'), ('[]');
  INSERT INTO notes (body) VALUES ('no links here');
`);

// psql variable :'old_origin' is not available outside psql, so substitute the quoted literal.
const sql = readFileSync(new URL("../deploy/vps/rewrite-image-urls.sql", import.meta.url), "utf8").replaceAll(
  ":'old_origin'",
  `'${OLD}'`,
);
await db.exec(sql);

let ok = true;
const check = (label, pass) => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) ok = false;
};
const one = async (q) => (await db.query(q)).rows;

const photos = await one("SELECT url, thumbnail_url FROM listing_photos ORDER BY id");
check("text column rewritten", photos[0].url === "/uploads/listings/a.jpg");
check("varchar column rewritten", photos[0].thumbnail_url === "/uploads/listings/thumb-a.jpg");
check("already-local link untouched", photos[1].url === "/uploads/listings/already-local.jpg");
check("third-party link untouched", photos[2].url === "https://images.unsplash.com/photo-1");
const ret = await one("SELECT photos FROM returns ORDER BY id");
check("jsonb array rewritten", ret[0].photos[0] === "/uploads/returns/1.jpg" && ret[0].photos[1] === "https://example.com/x.jpg");
check("empty jsonb untouched", JSON.stringify(ret[1].photos) === "[]");
check("unrelated text untouched", (await one("SELECT body FROM notes"))[0].body === "no links here");

// Safety: a bad old_origin must abort and change nothing.
let refused = false;
try {
  await db.exec(readFileSync(new URL("../deploy/vps/rewrite-image-urls.sql", import.meta.url), "utf8").replaceAll(":'old_origin'", "'/uploads/'"));
} catch {
  refused = true;
}
check("refuses a useless old_origin", refused);

await db.close();
process.exit(ok ? 0 : 1);

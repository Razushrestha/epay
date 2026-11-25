// Quick check that the VPS storage mode (STORAGE_DRIVER=fs) writes, reads and deletes files.
// Usage: node scripts/test-fs-storage.mjs
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "mero-uploads-"));
process.env.STORAGE_DRIVER = "fs";
process.env.UPLOAD_DIR = dir;
delete process.env.AWS_ENDPOINT_URL_S3;
delete process.env.CDN_PUBLIC_URL;
delete process.env.NEXT_PUBLIC_CDN_URL;

const { Files } = await import("files-sdk");
const { fs } = await import("files-sdk/fs");
const { publicObjectUrl } = await import("../server/cdn.mjs");
await import("../server/upload.mjs"); // must load without Neon credentials

const storage = new Files({ adapter: fs({ root: dir }) });
const bytes = Buffer.from("hello-image");
await storage.upload("listings/a.jpg", bytes, { contentType: "image/jpeg", cacheControl: "public, max-age=31536000" });

let ok = true;
const check = (label, pass) => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) ok = false;
};

check("file is written under UPLOAD_DIR", existsSync(join(dir, "listings", "a.jpg")));
check("file content is intact", readFileSync(join(dir, "listings", "a.jpg")).equals(bytes));
check("public URL stays /uploads/... (nginx serves it)", publicObjectUrl("listings/a.jpg") === "/uploads/listings/a.jpg");

let escaped = false;
try {
  await storage.upload("../escape.txt", bytes);
  escaped = existsSync(join(dir, "..", "escape.txt"));
} catch {
  escaped = false;
}
check("path traversal is rejected", !escaped);

await storage.delete("listings/a.jpg");
check("delete removes the file", !existsSync(join(dir, "listings", "a.jpg")));

rmSync(dir, { recursive: true, force: true });
process.exit(ok ? 0 : 1);

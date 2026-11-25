// Downloads every image from the Neon Object Storage "uploads" bucket into a local folder.
// Read-only: nothing is changed or deleted in Neon.
//
//   node --import dotenv/config deploy/vps/export-neon-uploads.mjs [outputFolder]
//
// Reads AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION from the environment (.env).
// Default output folder: .data/neon-uploads-export (git-ignored). Copy its contents to the VPS folder
// /var/lib/meroauction/uploads/ (see the guide).
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

const BUCKET = process.env.NEON_BUCKET || "uploads";
const endpoint = process.env.AWS_ENDPOINT_URL_S3;
if (!endpoint || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error("Set AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (they are in .env).");
  process.exit(1);
}

const outDir = resolve(process.argv[2] || ".data/neon-uploads-export");
mkdirSync(outDir, { recursive: true });

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  endpoint,
  forcePathStyle: true,
});

let token;
let count = 0;
let bytes = 0;
let skipped = 0;
do {
  const page = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }));
  for (const obj of page.Contents ?? []) {
    const target = resolve(outDir, obj.Key);
    if (!target.startsWith(outDir + sep)) {
      console.warn(`skip unsafe key ${obj.Key}`);
      continue;
    }
    if (existsSync(target) && statSync(target).size === obj.Size) {
      skipped++;
      count++;
      bytes += obj.Size;
      continue;
    }
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
    const data = Buffer.from(await res.Body.transformToByteArray());
    if (data.length !== obj.Size) throw new Error(`size mismatch for ${obj.Key}: got ${data.length}, expected ${obj.Size}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    count++;
    bytes += data.length;
  }
  token = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (token);

console.log(`Downloaded ${count} files (${bytes} bytes), ${skipped} already present, into ${outDir}`);

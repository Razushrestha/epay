import { createHmac, createPublicKey, createVerify, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, initDb } from "./db.mjs";
import { sellerDsr } from "./m3-commerce.mjs";
import { cdnify, cdnifyListing } from "./cdn.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const kycDir = join(__dirname, "..", ".data", "kyc");
const API = "/api/v1";
const KYC_TTL_SEC = 15 * 60;

export const POLICY_VERSIONS = {
  privacy: process.env.PRIVACY_POLICY_VERSION || "2026-10-15",
  terms: process.env.TERMS_VERSION || "2026-10-15",
  cookies: process.env.COOKIE_POLICY_VERSION || "2026-10-15",
};

let ready;

async function db() {
  if (!pool) await initDb();
  return pool;
}

export function ensureM1Tables() {
  if (!ready) ready = createM1Tables().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

async function createM1Tables() {
  const client = await db();
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_consents (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      policy TEXT NOT NULL CHECK (policy IN ('privacy', 'terms', 'cookies')),
      version TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, policy, version)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS kyc_access_logs (
      id BIGSERIAL PRIMARY KEY,
      document_id BIGINT NOT NULL REFERENCES kyc_documents (id) ON DELETE CASCADE,
      viewer_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
      kind TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS collections (
      id BIGSERIAL PRIMARY KEY,
      public_id UUID NOT NULL UNIQUE,
      user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS collection_items (
      collection_id BIGINT NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
      listing_id INTEGER NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (collection_id, listing_id)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS seller_follows (
      follower_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      seller_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, seller_id)
    )
  `);
  await client.query(`ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_provider_check`);
  await client.query(`
    ALTER TABLE social_accounts ADD CONSTRAINT social_accounts_provider_check
    CHECK (provider IN ('google', 'apple', 'facebook'))
  `).catch(() => {});
}

function requestMeta(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 300);
  return { ip, userAgent };
}

export async function recordConsents(userId, policies, req) {
  await ensureM1Tables();
  const { ip, userAgent } = requestMeta(req);
  const list = Array.isArray(policies) ? policies : ["privacy", "terms"];
  for (const policy of list) {
    if (!POLICY_VERSIONS[policy]) continue;
    await (await db()).query(
      `INSERT INTO user_consents (user_id, policy, version, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, policy, version) DO NOTHING`,
      [userId, policy, POLICY_VERSIONS[policy], ip || null, userAgent || null],
    );
  }
}

export async function listConsents(userId) {
  await ensureM1Tables();
  const { rows } = await (await db()).query(
    `SELECT policy, version, accepted_at FROM user_consents WHERE user_id = $1 ORDER BY accepted_at DESC`,
    [userId],
  );
  const latest = {};
  for (const row of rows) {
    if (!latest[row.policy]) latest[row.policy] = row;
  }
  return {
    current: POLICY_VERSIONS,
    accepted: rows,
    currentAccepted: {
      privacy: latest.privacy?.version === POLICY_VERSIONS.privacy,
      terms: latest.terms?.version === POLICY_VERSIONS.terms,
      cookies: latest.cookies?.version === POLICY_VERSIONS.cookies,
    },
  };
}

function kycSecret() {
  return process.env.KYC_URL_SECRET || process.env.SESSION_SECRET || "nexlo-kyc-dev";
}

function signKycToken(documentPublicId, kind) {
  const exp = Math.floor(Date.now() / 1000) + KYC_TTL_SEC;
  const payload = Buffer.from(JSON.stringify({ d: documentPublicId, k: kind, exp })).toString("base64url");
  const sig = createHmac("sha256", kycSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function parseKycToken(token) {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", kycSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data?.d || !data?.k || Number(data.exp) < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function signedKycFiles(publicId, filenames) {
  const files = {};
  for (const kind of ["front", "back", "selfie"]) {
    if (!filenames[kind]) continue;
    files[kind] = `/api/v1/kyc/file?t=${encodeURIComponent(signKycToken(publicId, kind))}`;
  }
  return files;
}

function mimeFor(file) {
  if (String(file).endsWith(".png")) return "image/png";
  if (String(file).endsWith(".pdf")) return "application/pdf";
  return "image/jpeg";
}

async function loadKycDoc(publicId) {
  const { rows } = await (await db()).query(
    `SELECT id, public_id, user_id, front_url, back_url, selfie_url FROM kyc_documents WHERE public_id = $1`,
    [publicId],
  );
  return rows[0] || null;
}

function fileForKind(doc, kind) {
  if (kind === "front") return doc.front_url;
  if (kind === "back") return doc.back_url;
  return doc.selfie_url;
}

export async function handleM1Public(req, res, ctx) {
  const { json, pathname, method, searchParams } = ctx;
  await ensureM1Tables();

  if (pathname === `${API}/kyc/file` && method === "GET") {
    const parsed = parseKycToken(searchParams.get("t"));
    if (!parsed) {
      json(req, res, 403, { error: "That document link expired. Open it again from admin." });
      return true;
    }
    const doc = await loadKycDoc(parsed.d);
    if (!doc) {
      json(req, res, 404, { error: "Document not found" });
      return true;
    }
    const file = fileForKind(doc, parsed.k);
    if (!file) {
      json(req, res, 404, { error: "File not found" });
      return true;
    }
    const bytes = existsSync(join(kycDir, String(doc.user_id), file))
      ? readFileSync(join(kycDir, String(doc.user_id), file))
      : null;
    if (!bytes) {
      json(req, res, 404, { error: "File not found" });
      return true;
    }
    const { ip, userAgent } = requestMeta(req);
    await (await db()).query(
      `INSERT INTO kyc_access_logs (document_id, kind, ip, user_agent) VALUES ($1, $2, $3, $4)`,
      [doc.id, parsed.k, ip || null, userAgent || null],
    );
    res.writeHead(200, {
      "Content-Type": mimeFor(file),
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `inline; filename="${parsed.k}"`,
    });
    res.end(bytes);
    return true;
  }

  const memberMatch = pathname.match(new RegExp(`^${API}/members/([^/]+)$`));
  if (memberMatch && method === "GET") {
    const handle = decodeURIComponent(memberMatch[1]).trim();
    const { rows } = await (await db()).query(
      `SELECT u.id, u.public_id, u.username, u.seller_level, u.account_type, u.created_at, u.is_seller,
              p.display_name, p.bio, p.avatar_url, p.country,
              COALESCE(fs.positive_count, 0) AS positive_count,
              COALESCE(fs.neutral_count, 0) AS neutral_count,
              COALESCE(fs.negative_count, 0) AS negative_count
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN feedback_scores fs ON fs.user_id = u.id
       WHERE u.deleted_at IS NULL
         AND (u.public_id::text = $1 OR lower(u.username) = lower($1) OR lower(COALESCE(p.display_name, '')) = lower($1))
       LIMIT 1`,
      [handle],
    );
    const user = rows[0];
    if (!user) {
      json(req, res, 404, { error: "Member not found" });
      return true;
    }
    const [feedback, listings, followers, dsr] = await Promise.all([
      (await db()).query(
        `SELECT f.rating, f.comment, f.created_at, COALESCE(p.display_name, u.username, 'Buyer') AS from_name
         FROM feedback f
         JOIN users u ON u.id = f.buyer_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
         WHERE f.seller_id = $1
         ORDER BY f.created_at DESC LIMIT 20`,
        [user.id],
      ),
      (await db()).query(
        `SELECT COUNT(*)::int AS c FROM listings WHERE seller_id = $1 AND status = 'active'`,
        [user.id],
      ),
      (await db()).query(
        `SELECT COUNT(*)::int AS c FROM seller_follows WHERE seller_id = $1`,
        [user.id],
      ).catch(() => ({ rows: [{ c: 0 }] })),
      sellerDsr(user.id),
    ]);
    json(req, res, 200, {
      member: {
        id: user.public_id,
        sellerId: user.id,
        username: user.username,
        displayName: user.display_name || user.username,
        bio: user.bio,
        avatarUrl: cdnify(user.avatar_url),
        country: user.country,
        sellerLevel: user.seller_level,
        accountType: user.account_type,
        isSeller: Boolean(user.is_seller) || user.account_type === "business",
        memberSince: user.created_at,
        listingCount: listings.rows[0]?.c || 0,
        followerCount: followers.rows[0]?.c || 0,
        feedback: {
          positive: Number(user.positive_count),
          neutral: Number(user.neutral_count),
          negative: Number(user.negative_count),
        },
        recentFeedback: feedback.rows,
        dsr,
      },
    });
    return true;
  }

  return false;
}

export async function handleM1Account(req, res, ctx, actor) {
  const { json, readJson, pathname, method } = ctx;
  await ensureM1Tables();

  if (pathname === `${API}/account/consents` && method === "GET") {
    return json(req, res, 200, await listConsents(actor.id));
  }

  if (pathname === `${API}/account/consents` && method === "POST") {
    const body = await readJson(req);
    const policies = Array.isArray(body.policies) ? body.policies : [body.policy].filter(Boolean);
    if (!policies.length) return json(req, res, 400, { error: "Choose a policy to accept" });
    await recordConsents(actor.id, policies, req);
    return json(req, res, 200, await listConsents(actor.id));
  }

  if (pathname === `${API}/account/kyc` && method === "GET") {
    const { rows } = await (await db()).query(
      `SELECT public_id, doc_type, status, rejection_reason, front_url, back_url, selfie_url, created_at
       FROM kyc_documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [actor.id],
    );
    const doc = rows[0];
    if (!doc) return json(req, res, 200, { kyc: null });
    return json(req, res, 200, {
      kyc: {
        id: doc.public_id,
        type: doc.doc_type,
        status: doc.status,
        reason: doc.rejection_reason,
        createdAt: doc.created_at,
        files: signedKycFiles(doc.public_id, { front: doc.front_url, back: doc.back_url, selfie: doc.selfie_url }),
      },
    });
  }

  if (pathname === `${API}/account/follows` && method === "GET") {
    const { rows } = await (await db()).query(
      `SELECT u.id AS seller_id, u.public_id, u.username, u.seller_level, p.display_name, p.avatar_url, p.bio,
              f.created_at,
              (SELECT COUNT(*)::int FROM listings l WHERE l.seller_id = u.id AND l.status = 'active') AS listing_count
       FROM seller_follows f
       JOIN users u ON u.id = f.seller_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC`,
      [actor.id],
    );
    return json(req, res, 200, { data: rows.map((row) => ({ ...row, avatar_url: cdnify(row.avatar_url) })) });
  }

  if (pathname === `${API}/account/collections` && method === "GET") {
    const { rows } = await (await db()).query(
      `SELECT c.public_id, c.name, c.created_at, c.updated_at,
              COUNT(i.listing_id)::int AS item_count
       FROM collections c
       LEFT JOIN collection_items i ON i.collection_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.updated_at DESC`,
      [actor.id],
    );
    return json(req, res, 200, { data: rows });
  }

  if (pathname === `${API}/account/collections` && method === "POST") {
    const body = await readJson(req);
    const name = String(body.name ?? "").trim();
    if (name.length < 2) return json(req, res, 400, { error: "Give the collection a name" });
    const { rows } = await (await db()).query(
      `INSERT INTO collections (public_id, user_id, name) VALUES ($1, $2, $3)
       RETURNING public_id, name, created_at, updated_at`,
      [randomUUID(), actor.id, name],
    );
    return json(req, res, 201, { data: { ...rows[0], item_count: 0 } });
  }

  const collectionMatch = pathname.match(new RegExp(`^${API}/account/collections/([^/]+)(?:/items)?$`));
  if (collectionMatch) {
    const { rows: owned } = await (await db()).query(
      `SELECT * FROM collections WHERE public_id = $1 AND user_id = $2`,
      [collectionMatch[1], actor.id],
    );
    const collection = owned[0];
    if (!collection) return json(req, res, 404, { error: "Collection not found" });
    const isItems = pathname.endsWith("/items");

    if (!isItems && method === "GET") {
      const { rows } = await (await db()).query(
        `SELECT l.id, l.title, l.price, l.auction_current_price, l.format, l.status,
                (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true LIMIT 1) AS primary_photo
         FROM collection_items i
         JOIN listings l ON l.id = i.listing_id
         WHERE i.collection_id = $1
         ORDER BY i.created_at DESC`,
        [collection.id],
      );
      return json(req, res, 200, { data: { ...collection, items: rows.map(cdnifyListing) } });
    }

    if (!isItems && method === "PATCH") {
      const body = await readJson(req);
      const name = String(body.name ?? "").trim();
      if (name.length < 2) return json(req, res, 400, { error: "Give the collection a name" });
      await (await db()).query(`UPDATE collections SET name = $2, updated_at = NOW() WHERE id = $1`, [collection.id, name]);
      return json(req, res, 200, { data: { public_id: collection.public_id, name } });
    }

    if (!isItems && method === "DELETE") {
      await (await db()).query(`DELETE FROM collections WHERE id = $1`, [collection.id]);
      return json(req, res, 200, { data: { deleted: true } });
    }

    if (isItems && method === "POST") {
      const body = await readJson(req);
      const listingId = Number(body.listingId);
      if (!listingId) return json(req, res, 400, { error: "Listing is required" });
      await (await db()).query(
        `INSERT INTO collection_items (collection_id, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [collection.id, listingId],
      );
      await (await db()).query(`UPDATE collections SET updated_at = NOW() WHERE id = $1`, [collection.id]);
      return json(req, res, 200, { data: { saved: true } });
    }

    if (isItems && method === "DELETE") {
      const body = await readJson(req);
      const listingId = Number(body.listingId);
      await (await db()).query(`DELETE FROM collection_items WHERE collection_id = $1 AND listing_id = $2`, [
        collection.id,
        listingId,
      ]);
      return json(req, res, 200, { data: { saved: false } });
    }
  }

  return false;
}

function b64urlToBuf(value) {
  const pad = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(pad + "=".repeat((4 - (pad.length % 4)) % 4), "base64");
}

export async function verifyAppleIdToken(idToken) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new Error("Apple sign-in token was not valid");
  const header = JSON.parse(b64urlToBuf(parts[0]).toString("utf8"));
  const payload = JSON.parse(b64urlToBuf(parts[1]).toString("utf8"));
  const keysRes = await fetch("https://appleid.apple.com/auth/keys");
  if (!keysRes.ok) throw new Error("Apple could not confirm that sign-in");
  const { keys } = await keysRes.json();
  const jwk = (keys || []).find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("Apple sign-in key was not recognised");
  const key = createPublicKey({ key: jwk, format: "jwk" });
  const verify = createVerify("RSA-SHA256");
  verify.update(`${parts[0]}.${parts[1]}`);
  verify.end();
  if (!verify.verify(key, b64urlToBuf(parts[2]))) throw new Error("Apple could not confirm that sign-in");
  if (payload.iss !== "https://appleid.apple.com") throw new Error("Apple token issuer did not match");
  const audience = process.env.APPLE_CLIENT_ID || process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
  if (audience && payload.aud !== audience) throw new Error("Apple token audience did not match");
  if (Number(payload.exp) * 1000 < Date.now()) throw new Error("Apple sign-in expired. Try again.");
  return payload;
}

export async function verifyFacebookToken(accessToken) {
  const appId = process.env.FACEBOOK_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (appId && appSecret) {
    const debug = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`,
    );
    if (!debug.ok) throw new Error("Facebook could not confirm that sign-in");
    const info = await debug.json();
    if (!info?.data?.is_valid || String(info.data.app_id) !== String(appId)) {
      throw new Error("Facebook token did not match this app");
    }
  }
  const me = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!me.ok) throw new Error("Facebook could not confirm that sign-in");
  return me.json();
}

import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { pool, checkDb, initDb } from "./db.mjs";

async function db() {
  if (!pool) await initDb();
  return pool;
}

const API_PREFIX = "/api/v1";

function setCors(req, res) {
  const configured = process.env.CORS_ORIGIN;
  const origin = req.headers.origin;
  if (configured) {
    res.setHeader("Access-Control-Allow-Origin", configured);
  } else if (
    origin &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(req, res, status, body) {
  setCors(req, res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password, stored) {
  const [algo, saltHex, hashHex] = stored.split(":");
  if (algo !== "scrypt") return false;
  const hash = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return (
    hash.length === expected.length && timingSafeEqual(hash, expected)
  );
}

function parseUrl(req) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  return { pathname: url.pathname, searchParams: url.searchParams };
}

export async function handleRequest(req, res) {
  const { pathname, searchParams } = parseUrl(req);
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    setCors(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === "/health" && method === "GET") {
    let db = false;
    try {
      db = await checkDb();
    } catch {
      db = false;
    }
    return json(req, res, 200, {
      status: "ok",
      service: "nexlo",
      runtime: "node",
      database: db ? "connected" : "unavailable",
    });
  }

  if (pathname === `${API_PREFIX}/categories` && method === "GET") {
    const parentSlug = searchParams.get("parent");
    let query = `
      SELECT id, parent_id, name, slug, level, path, icon_url,
             sort_order, allow_auction, allow_fixed, allow_offer, is_active
      FROM categories c
      WHERE is_active = TRUE
    `;
    const params = [];
    if (parentSlug) {
      params.push(parentSlug);
      query += ` AND parent_id = (SELECT id FROM categories WHERE slug = $1 LIMIT 1)`;
    } else {
      query += " AND parent_id IS NULL";
    }
    query += " ORDER BY sort_order, name";
    const { rows } = await (await db()).query(query, params);
    return json(req, res, 200, { data: rows });
  }

  if (pathname === `${API_PREFIX}/conditions` && method === "GET") {
    const { rows } = await (await db()).query(
      "SELECT id, name, description FROM conditions ORDER BY id",
    );
    return json(req, res, 200, { data: rows });
  }

  if (pathname === `${API_PREFIX}/auth/register` && method === "POST") {
    const body = await readJson(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const displayName = String(body.displayName ?? "").trim() || null;
    const accountType = body.accountType === "business" ? "business" : "individual";
    const country = String(body.country ?? "").trim() || null;
    const buyerOnly = Boolean(body.buyerOnly);

    if (!email || !email.includes("@")) {
      return json(req, res, 400, { error: "Valid email is required" });
    }
    if (password.length < 8) {
      return json(req, res, 400, { error: "Password must be at least 8 characters" });
    }
    if (accountType === "business" && !country) {
      return json(req, res, 400, { error: "Select where your business is registered" });
    }

    const passwordHash = hashPassword(password);
    const client = await (await db()).connect();
    try {
      await client.query("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS country TEXT");
      await client.query(
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS buyer_only BOOLEAN NOT NULL DEFAULT FALSE",
      );
      await client.query("BEGIN");
      const {
        rows: [user],
      } = await client.query(
        `INSERT INTO users (public_id, email, password_hash, status, account_type)
         VALUES ($1, $2, $3, 'active', $4)
         RETURNING id, public_id, email, account_type, status, seller_level, created_at`,
        [randomUUID(), email, passwordHash, accountType],
      );
      await client.query(
        `INSERT INTO user_profiles (user_id, display_name, country, buyer_only)
         VALUES ($1, $2, $3, $4)`,
        [user.id, displayName ?? email.split("@")[0], country, buyerOnly],
      );
      await client.query(
        `INSERT INTO outbox (aggregate, event_type, payload)
         VALUES ('user', 'user.registered', $1::jsonb)`,
        [JSON.stringify({ userId: user.public_id, email })],
      );
      await client.query("COMMIT");
      return json(req, res, 201, { data: user });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "23505") {
        return json(req, res, 409, { error: "Email already registered" });
      }
      throw err;
    } finally {
      client.release();
    }
  }

  if (pathname === `${API_PREFIX}/auth/login` && method === "POST") {
    const body = await readJson(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    const { rows } = await (await db()).query(
      `SELECT u.id, u.public_id, u.email, u.password_hash, u.status,
              p.display_name
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.email = $1 AND u.deleted_at IS NULL`,
      [email],
    );
    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return json(req, res, 401, { error: "Invalid email or password" });
    }
    if (user.status !== "active") {
      return json(req, res, 403, { error: "Account is not active" });
    }
    const { password_hash: _, ...safe } = user;
    return json(req, res, 200, {
      data: safe,
      message: "Session tokens (JWT) will be added in the identity module",
    });
  }

  return json(req, res, 404, { error: "Not found" });
}

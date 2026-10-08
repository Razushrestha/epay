import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, initDb } from "./db.mjs";
import { rateLimit, RateLimitConfig, clearRateLimit } from "./security/rate-limit.mjs";
import { deliverCode } from "./mail.mjs";
import { handleStaffExtras } from "./staff.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const kycDir = join(__dirname, "..", ".data", "kyc");
const API = "/api/v1";
const devCodes = process.env.NODE_ENV !== "production";

async function db() {
  if (!pool) await initDb();
  return pool;
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [algo, saltHex, hashHex] = stored.split(":");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const hash = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashCode(code) {
  return `sha256:${sha256(String(code))}`;
}

function codesMatch(code, stored) {
  if (!stored?.startsWith("sha256:")) return false;
  const a = Buffer.from(sha256(String(code)), "hex");
  const b = Buffer.from(stored.slice(7), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    out += B32[Number.parseInt(chunk, 2)];
  }
  return out;
}

function base32Decode(text) {
  const clean = text.replace(/=+$/g, "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const index = B32.indexOf(char);
    if (index < 0) continue;
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret, counter) {
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", secret).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

function verifyTotp(secretBase32, code) {
  const secret = base32Decode(secretBase32);
  const step = Math.floor(Date.now() / 30000);
  const given = String(code).replace(/\s/g, "");
  return [-1, 0, 1].some((delta) => hotp(secret, step + delta) === given);
}

function sellerLevel(positive, neutral, negative) {
  const total = positive + neutral + negative;
  if (total < 5) return "new";
  const rate = positive / total;
  if (total >= 50 && rate >= 0.98) return "top_rated";
  if (total >= 20 && rate >= 0.95) return "above_standard";
  return "standard";
}

function looksLikeEmail(value) {
  return value.includes("@");
}

async function findUser(identifier) {
  const key = String(identifier ?? "").trim().toLowerCase();
  const { rows } = await (await db()).query(
    `SELECT u.*, p.display_name, p.first_name, p.last_name, p.country, p.bio, p.avatar_url, p.buyer_only,
            b.legal_name, b.registration_country, b.tax_id, b.website,
            t.method AS two_factor_method, t.enabled_at AS two_factor_enabled, t.secret
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     LEFT JOIN business_profiles b ON b.user_id = u.id
     LEFT JOIN two_factor t ON t.user_id = u.id
     WHERE u.deleted_at IS NULL
       AND (lower(u.email) = $1 OR u.phone = $1 OR lower(u.username) = $1 OR u.public_id::text = $1)`,
    [key],
  );
  return rows[0] ?? null;
}

async function feedbackFor(userId) {
  const { rows } = await (await db()).query(
    `SELECT positive_count, neutral_count, negative_count FROM feedback_scores WHERE user_id = $1`,
    [userId],
  );
  return rows[0] ?? { positive_count: 0, neutral_count: 0, negative_count: 0 };
}

async function latestKyc(userId) {
  const { rows } = await (await db()).query(
    `SELECT public_id, doc_type, status, rejection_reason, created_at, reviewed_at
     FROM kyc_documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

function publicUser(user, score, kyc) {
  return {
    id: user.public_id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    accountType: user.account_type,
    status: user.status,
    sellerLevel: user.seller_level,
    isSeller: user.is_seller,
    isStaff: user.is_staff,
    displayName: user.display_name,
    firstName: user.first_name,
    lastName: user.last_name,
    country: user.country,
    bio: user.bio,
    avatarUrl: user.avatar_url || null,
    buyerOnly: user.buyer_only,
    business: user.legal_name
      ? {
          legalName: user.legal_name,
          registrationCountry: user.registration_country,
          taxId: user.tax_id,
          website: user.website,
        }
      : null,
    emailVerified: Boolean(user.email_verified_at),
    phoneVerified: Boolean(user.phone_verified_at),
    twoFactor: user.two_factor_enabled ? user.two_factor_method : null,
    feedback: {
      positive: Number(score.positive_count),
      neutral: Number(score.neutral_count),
      negative: Number(score.negative_count),
    },
    kyc: kyc
      ? { id: kyc.public_id, type: kyc.doc_type, status: kyc.status, reason: kyc.rejection_reason }
      : null,
    createdAt: user.created_at,
  };
}

async function loadPublic(user) {
  const [score, kyc, social] = await Promise.all([
    feedbackFor(user.id),
    latestKyc(user.id),
    (await db()).query(`SELECT provider FROM social_accounts WHERE user_id = $1`, [user.id]),
  ]);
  return { ...publicUser(user, score, kyc), social: social.rows.map((row) => row.provider) };
}

async function issueCode(user, purpose, destination, channel) {
  const code = String(randomInt(100000, 1000000));
  await (await db()).query(
    `INSERT INTO verification_codes (user_id, channel, purpose, destination, code_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '10 minutes')`,
    [user.id, channel, purpose, destination, hashCode(code)],
  );
  await deliverCode(channel, destination, code, purpose);
  return code;
}

async function consumeCode(userId, purpose, code) {
  const { rows } = await (await db()).query(
    `SELECT id, code_hash, attempts, expires_at, verified_at
     FROM verification_codes
     WHERE user_id = $1 AND purpose = $2
     ORDER BY created_at DESC LIMIT 1`,
    [userId, purpose],
  );
  const row = rows[0];
  if (!row || row.verified_at) return "missing";
  if (new Date(row.expires_at).getTime() < Date.now()) return "expired";
  if (row.attempts >= 5) return "locked";
  if (!codesMatch(code, row.code_hash)) {
    await (await db()).query(`UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
    return "invalid";
  }
  await (await db()).query(`UPDATE verification_codes SET verified_at = NOW() WHERE id = $1`, [row.id]);
  return "ok";
}

function clientMeta(req, remember) {
  const days = remember ? 30 : 1;
  return {
    agent: String(req.headers["user-agent"] ?? "Unknown device").slice(0, 240),
    ip: String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "").slice(0, 64),
    expires: new Date(Date.now() + days * 86400000).toISOString(),
  };
}

async function openSession(user, req, remember) {
  const token = randomBytes(32).toString("hex");
  const meta = clientMeta(req, remember);
  await (await db()).query(
    `INSERT INTO auth_sessions (public_id, user_id, token_hash, user_agent, ip, remember, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [randomUUID(), user.id, sha256(token), meta.agent, meta.ip, Boolean(remember), meta.expires],
  );
  return token;
}

async function sessionUser(req) {
  const header = String(req.headers.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const { rows } = await (await db()).query(
    `SELECT s.id AS session_id, s.expires_at, s.revoked_at, u.*,
            p.display_name, p.first_name, p.last_name, p.country, p.bio, p.avatar_url, p.buyer_only,
            b.legal_name, b.registration_country, b.tax_id, b.website,
            t.method AS two_factor_method, t.enabled_at AS two_factor_enabled
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN user_profiles p ON p.user_id = u.id
     LEFT JOIN business_profiles b ON b.user_id = u.id
     LEFT JOIN two_factor t ON t.user_id = u.id
     WHERE s.token_hash = $1 AND u.deleted_at IS NULL`,
    [sha256(token)],
  );
  const row = rows[0];
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) return null;
  await (await db()).query(`UPDATE auth_sessions SET last_seen_at = NOW() WHERE id = $1`, [row.session_id]);
  return row;
}

async function refreshStanding(user) {
  if (user.status !== "suspended" && user.status !== "restricted") return user;
  const { rows } = await (await db()).query(
    `SELECT action, until_at FROM account_actions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [user.id],
  );
  const latest = rows[0];
  if (latest?.until_at && new Date(latest.until_at).getTime() < Date.now() && latest.action !== "restore") {
    await (await db()).query(`UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1`, [user.id]);
    user.status = "active";
  }
  return user;
}

async function createChallenge(user, purpose) {
  const token = randomBytes(24).toString("hex");
  await (await db()).query(
    `INSERT INTO auth_challenges (token_hash, user_id, purpose, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
    [sha256(token), user.id, purpose],
  );
  return token;
}

async function readChallenge(token, purpose) {
  const { rows } = await (await db()).query(
    `SELECT c.user_id, u.public_id FROM auth_challenges c
     JOIN users u ON u.id = c.user_id
     WHERE c.token_hash = $1 AND c.purpose = $2 AND c.expires_at > NOW()`,
    [sha256(token), purpose],
  );
  return rows[0] ?? null;
}

async function recomputeLevel(sellerId) {
  const score = await feedbackFor(sellerId);
  const level = sellerLevel(
    Number(score.positive_count),
    Number(score.neutral_count),
    Number(score.negative_count),
  );
  await (await db()).query(`UPDATE users SET seller_level = $2, updated_at = NOW() WHERE id = $1`, [sellerId, level]);
  return level;
}

function saveKycFile(userId, name, dataUrl) {
  const match = String(dataUrl).match(/^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 32 || bytes.length > 1_500_000) return null;
  const ext = match[1].includes("png") ? "png" : match[1].includes("pdf") ? "pdf" : "jpg";
  const dir = join(kycDir, String(userId));
  mkdirSync(dir, { recursive: true });
  const file = `${name}-${randomUUID()}.${ext}`;
  writeFileSync(join(dir, file), bytes);
  return file;
}

async function promoteAdmin() {
  const email = String(process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) return;
  await (await db()).query(
    `UPDATE users SET is_staff = TRUE, status = 'active', updated_at = NOW() WHERE lower(email) = $1`,
    [email],
  );
}

export async function handleIdentity(req, res, ctx) {
  const { json, readJson, pathname, method } = ctx;
  if (!pathname.startsWith(`${API}/auth`) && !pathname.startsWith(`${API}/account`) && !pathname.startsWith(`${API}/admin`)) {
    return false;
  }
  await promoteAdmin();

  if (pathname === `${API}/auth/register` && method === "POST") {
    // Rate limit check
    const rateLimitResult = rateLimit(req, RateLimitConfig.AUTH_REGISTER);
    if (rateLimitResult) {
      if (rateLimitResult.headers) {
        Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      return json(req, res, rateLimitResult.status, rateLimitResult.body);
    }

    const body = await readJson(req);
    const email = String(body.email ?? "").trim().toLowerCase() || null;
    const phone = String(body.phone ?? "").replace(/\s/g, "") || null;
    const password = String(body.password ?? "");
    const accountType = body.accountType === "business" ? "business" : "individual";
    const firstName = String(body.firstName ?? "").trim() || null;
    const lastName = String(body.lastName ?? "").trim() || null;
    const displayName = String(body.displayName ?? "").trim() || [firstName, lastName].filter(Boolean).join(" ") || null;
    const country = String(body.country ?? "").trim() || null;
    if (!email && !phone) return json(req, res, 400, { error: "Email or phone is required" });
    if (email && !email.includes("@")) return json(req, res, 400, { error: "Enter a valid email" });
    if (password.length < 8) return json(req, res, 400, { error: "Password must be at least 8 characters" });
    const client = await (await db()).connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `INSERT INTO users (public_id, email, phone, password_hash, status, account_type)
         VALUES ($1, $2, $3, $4, 'pending', $5)
         RETURNING id, public_id, email, phone`,
        [randomUUID(), email, phone, hashPassword(password), accountType],
      );
      const user = rows[0];
      await client.query(
        `INSERT INTO user_profiles (user_id, first_name, last_name, display_name, country, buyer_only)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.id, firstName, lastName, displayName, country, Boolean(body.buyerOnly)],
      );
      if (accountType === "business" && displayName) {
        await client.query(
          `INSERT INTO business_profiles (user_id, legal_name, registration_country) VALUES ($1, $2, $3)`,
          [user.id, displayName, country],
        );
      }
      await client.query(
        `INSERT INTO feedback_scores (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [user.id],
      );
      const channel = email ? "email" : "phone";
      const destination = email || phone;
      const code = String(randomInt(100000, 1000000));
      await client.query(
        `INSERT INTO verification_codes (user_id, channel, purpose, destination, code_hash, expires_at)
         VALUES ($1, $2, 'verify', $3, $4, NOW() + INTERVAL '10 minutes')`,
        [user.id, channel, destination, hashCode(code)],
      );
      await client.query("COMMIT");
      await deliverCode(channel, destination, code, "verify");
      return json(req, res, 201, {
        data: { id: user.public_id, destination, channel, devCode: devCodes ? code : undefined },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "23505") return json(req, res, 409, { error: "That email or phone is already registered" });
      throw err;
    } finally {
      client.release();
    }
  }

  if (pathname === `${API}/auth/resend` && method === "POST") {
    const rateLimitResult = rateLimit(req, RateLimitConfig.AUTH_FORGOT_PASSWORD);
    if (rateLimitResult) {
      if (rateLimitResult.headers) {
        Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      return json(req, res, rateLimitResult.status, rateLimitResult.body);
    }

    const body = await readJson(req);
    const user = await findUser(body.identifier);
    if (!user) return json(req, res, 200, { data: { sent: true } });
    const channel = user.email ? "email" : user.phone ? "phone" : "email";
    const destination = channel === "phone" ? user.phone : user.email;
    if (!destination) return json(req, res, 400, { error: "This account has no email or phone" });
    const code = await issueCode(user, "verify", destination, channel);
    return json(req, res, 200, {
      data: { sent: true, destination, channel, devCode: devCodes ? code : undefined },
    });
  }

  if (pathname === `${API}/auth/verify` && method === "POST") {
    // Rate limit check
    const rateLimitResult = rateLimit(req, RateLimitConfig.AUTH_VERIFY);
    if (rateLimitResult) {
      if (rateLimitResult.headers) {
        Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      return json(req, res, rateLimitResult.status, rateLimitResult.body);
    }

    const body = await readJson(req);
    const user = await findUser(body.identifier);
    if (!user) return json(req, res, 400, { error: "Account not found" });
    const result = await consumeCode(user.id, "verify", body.code);
    if (result !== "ok") return json(req, res, 400, { error: "That code is not valid" });
    const channel = looksLikeEmail(String(body.identifier)) ? "email_verified_at" : "phone_verified_at";
    await (await db()).query(
      `UPDATE users SET status = 'active', ${channel} = NOW(), updated_at = NOW() WHERE id = $1`,
      [user.id],
    );
    user.status = "active";
    const token = await openSession(user, req, true);
    return json(req, res, 200, { token, user: await loadPublic(user) });
  }

  if (pathname === `${API}/auth/login` && method === "POST") {
    // Rate limit check
    const rateLimitResult = rateLimit(req, RateLimitConfig.AUTH_LOGIN);
    if (rateLimitResult) {
      if (rateLimitResult.headers) {
        Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      return json(req, res, rateLimitResult.status, rateLimitResult.body);
    }

    const body = await readJson(req);
    const user = await findUser(body.identifier ?? body.email);
    if (!user || !verifyPassword(String(body.password ?? ""), user.password_hash)) {
      return json(req, res, 401, { error: "Invalid email, phone, or password" });
    }
    
    // Clear rate limit on successful authentication
    clearRateLimit(req);
    
    await refreshStanding(user);
    if (user.status === "pending") return json(req, res, 403, { error: "Verify the code we sent before signing in" });
    if (user.status === "suspended") {
      return json(req, res, 403, { error: "This account is suspended. You can appeal from the sign-in page after a reset, or contact support." });
    }
    const must2fa = user.is_seller || user.is_staff;
    if (must2fa && !user.two_factor_enabled && !(body.adminPortal && user.is_staff)) {
      const challengeToken = await createChallenge(user, "enroll_2fa");
      return json(req, res, 200, { step: "enroll", challengeToken });
    }
    if (user.two_factor_enabled) {
      const challengeToken = await createChallenge(user, "login_2fa");
      let devCode;
      if (user.two_factor_method === "otp") {
        const channel = user.email ? "email" : "phone";
        devCode = await issueCode(user, "login_2fa", user.email || user.phone, channel);
      }
      return json(req, res, 200, {
        step: "challenge",
        method: user.two_factor_method,
        challengeToken,
        devCode: devCodes ? devCode : undefined,
      });
    }
    const token = await openSession(user, req, body.remember !== false);
    return json(req, res, 200, { token, user: await loadPublic(user) });
  }

  if (pathname === `${API}/auth/2fa` && method === "POST") {
    // Rate limit check
    const rateLimitResult = rateLimit(req, RateLimitConfig.AUTH_2FA);
    if (rateLimitResult) {
      if (rateLimitResult.headers) {
        Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      return json(req, res, rateLimitResult.status, rateLimitResult.body);
    }

    const body = await readJson(req);
    const challenge = await readChallenge(body.challengeToken, "login_2fa");
    if (!challenge) return json(req, res, 400, { error: "That sign-in challenge expired" });
    const user = await findUser(challenge.public_id);
    let ok = false;
    if (user.two_factor_method === "authenticator") ok = verifyTotp(user.secret ?? "", body.code);
    else ok = (await consumeCode(user.id, "login_2fa", body.code)) === "ok";
    if (!ok) return json(req, res, 401, { error: "That code is not valid" });
    const full = await findUser(user.email || user.phone);
    const token = await openSession(full, req, true);
    return json(req, res, 200, { token, user: await loadPublic(full) });
  }

  if (pathname === `${API}/auth/google` && method === "POST") {
    const body = await readJson(req);
    let email = String(body.email ?? "").trim().toLowerCase();
    let name = String(body.name ?? "").trim();
    let sub = String(body.sub ?? "").trim();
    if (body.idToken) {
      const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(body.idToken)}`);
      if (!info.ok) return json(req, res, 401, { error: "Google could not confirm that sign-in" });
      const profile = await info.json();
      email = String(profile.email ?? "").toLowerCase();
      name = profile.name || email;
      sub = profile.sub;
    }
    if (!email || !email.includes("@")) return json(req, res, 400, { error: "A Google email is required" });
    if (!sub) sub = `dev:${email}`;
    let user = await findUser(email);
    if (!user) {
      const { rows } = await (await db()).query(
        `INSERT INTO users (public_id, email, status, email_verified_at, account_type)
         VALUES ($1, $2, 'active', NOW(), 'individual') RETURNING id, public_id, email`,
        [randomUUID(), email],
      );
      await (await db()).query(
        `INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2)`,
        [rows[0].id, name || email.split("@")[0]],
      );
      await (await db()).query(`INSERT INTO feedback_scores (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [rows[0].id]);
      user = await findUser(email);
    }
    await (await db()).query(
      `INSERT INTO social_accounts (user_id, provider, provider_user_id, email)
       VALUES ($1, 'google', $2, $3)
       ON CONFLICT (provider, provider_user_id) DO NOTHING`,
      [user.id, sub, email],
    );
    if (user.status === "suspended") return json(req, res, 403, { error: "This account is suspended" });
    const token = await openSession(user, req, true);
    return json(req, res, 200, { token, user: await loadPublic(user) });
  }

  if (pathname === `${API}/auth/forgot` && method === "POST") {
    // Rate limit check
    const rateLimitResult = rateLimit(req, RateLimitConfig.AUTH_FORGOT_PASSWORD);
    if (rateLimitResult) {
      if (rateLimitResult.headers) {
        Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      return json(req, res, rateLimitResult.status, rateLimitResult.body);
    }

    const body = await readJson(req);
    const user = await findUser(body.identifier);
    if (!user) return json(req, res, 200, { data: { sent: true } });
    const channel = user.email && looksLikeEmail(String(body.identifier)) ? "email" : user.phone ? "phone" : "email";
    const destination = channel === "phone" ? user.phone : user.email;
    if (!destination) return json(req, res, 400, { error: "This account has no email or phone to reset with" });
    const code = await issueCode(user, "reset", destination, channel);
    return json(req, res, 200, { data: { sent: true, destination, devCode: devCodes ? code : undefined } });
  }

  if (pathname === `${API}/auth/reset` && method === "POST") {
    const body = await readJson(req);
    const user = await findUser(body.identifier);
    if (!user) return json(req, res, 400, { error: "Account not found" });
    if (String(body.password ?? "").length < 8) return json(req, res, 400, { error: "Password must be at least 8 characters" });
    const result = await consumeCode(user.id, "reset", body.code);
    if (result !== "ok") return json(req, res, 400, { error: "That code is not valid" });
    await (await db()).query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [
      user.id,
      hashPassword(String(body.password)),
    ]);
    await (await db()).query(`UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [user.id]);
    return json(req, res, 200, { data: { reset: true } });
  }

  const actor = await sessionUser(req);
  if (!actor && pathname.startsWith(`${API}/account`)) return json(req, res, 401, { error: "Sign in required" });
  if (!actor && pathname.startsWith(`${API}/admin`)) return json(req, res, 401, { error: "Sign in required" });

  if (pathname === `${API}/account` && method === "GET") {
    await refreshStanding(actor);
    return json(req, res, 200, { user: await loadPublic(actor) });
  }

  if (pathname === `${API}/account/profile` && method === "PATCH") {
    const body = await readJson(req);
    await (await db()).query(
      `UPDATE user_profiles
       SET first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           display_name = COALESCE($4, display_name),
           bio = COALESCE($5, bio),
           country = COALESCE($6, country)
       WHERE user_id = $1`,
      [
        actor.id,
        body.firstName ?? null,
        body.lastName ?? null,
        body.displayName ?? null,
        body.bio ?? null,
        body.country ?? null,
      ],
    );
    if (typeof body.username === "string") {
      const username = body.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 32);
      if (username.length >= 3) {
        await (await db()).query(`UPDATE users SET username = $2, updated_at = NOW() WHERE id = $1`, [actor.id, username]);
      }
    }
    if (body.accountType === "business" || body.accountType === "individual") {
      await (await db()).query(`UPDATE users SET account_type = $2, updated_at = NOW() WHERE id = $1`, [
        actor.id,
        body.accountType,
      ]);
    }
    if (body.business) {
      await (await db()).query(
        `INSERT INTO business_profiles (user_id, legal_name, registration_country, tax_id, website)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE
         SET legal_name = EXCLUDED.legal_name,
             registration_country = EXCLUDED.registration_country,
             tax_id = EXCLUDED.tax_id,
             website = EXCLUDED.website,
             updated_at = NOW()`,
        [
          actor.id,
          String(body.business.legalName ?? actor.display_name ?? "Business"),
          body.business.registrationCountry ?? null,
          body.business.taxId ?? null,
          body.business.website ?? null,
        ],
      );
    }
    const fresh = await findUser(actor.email || actor.phone || actor.public_id);
    return json(req, res, 200, { user: await loadPublic(fresh) });
  }

  if (pathname === `${API}/account/addresses` && method === "GET") {
    const { rows } = await (await db()).query(
      `SELECT public_id, label, full_name, phone, line1, line2, city, region, postal_code, country,
              is_default_shipping, is_default_billing
       FROM addresses WHERE user_id = $1 ORDER BY created_at`,
      [actor.id],
    );
    return json(req, res, 200, { data: rows });
  }

  if (pathname === `${API}/account/addresses` && method === "POST") {
    const body = await readJson(req);
    if (!body.fullName || !body.line1 || !body.city) {
      return json(req, res, 400, { error: "Name, street, and city are required" });
    }
    if (body.defaultShipping) {
      await (await db()).query(`UPDATE addresses SET is_default_shipping = FALSE WHERE user_id = $1`, [actor.id]);
    }
    if (body.defaultBilling) {
      await (await db()).query(`UPDATE addresses SET is_default_billing = FALSE WHERE user_id = $1`, [actor.id]);
    }
    const { rows } = await (await db()).query(
      `INSERT INTO addresses (
         public_id, user_id, label, full_name, phone, line1, line2, city, region, postal_code, country,
         is_default_shipping, is_default_billing
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING public_id`,
      [
        randomUUID(),
        actor.id,
        body.label ?? null,
        body.fullName,
        body.phone ?? null,
        body.line1,
        body.line2 ?? null,
        body.city,
        body.region ?? null,
        body.postalCode ?? null,
        body.country || "Nepal",
        Boolean(body.defaultShipping),
        Boolean(body.defaultBilling),
      ],
    );
    return json(req, res, 201, { data: rows[0] });
  }

  const addressMatch = pathname.match(new RegExp(`^${API}/account/addresses/([^/]+)$`));
  if (addressMatch && method === "DELETE") {
    await (await db()).query(`DELETE FROM addresses WHERE public_id = $1 AND user_id = $2`, [addressMatch[1], actor.id]);
    return json(req, res, 200, { data: { removed: true } });
  }
  if (addressMatch && method === "PATCH") {
    const body = await readJson(req);
    if (body.defaultShipping) {
      await (await db()).query(`UPDATE addresses SET is_default_shipping = FALSE WHERE user_id = $1`, [actor.id]);
    }
    if (body.defaultBilling) {
      await (await db()).query(`UPDATE addresses SET is_default_billing = FALSE WHERE user_id = $1`, [actor.id]);
    }
    await (await db()).query(
      `UPDATE addresses SET
         label = COALESCE($3, label),
         full_name = COALESCE($4, full_name),
         phone = COALESCE($5, phone),
         line1 = COALESCE($6, line1),
         line2 = COALESCE($7, line2),
         city = COALESCE($8, city),
         region = COALESCE($9, region),
         postal_code = COALESCE($10, postal_code),
         country = COALESCE($11, country),
         is_default_shipping = CASE WHEN $12 THEN TRUE ELSE is_default_shipping END,
         is_default_billing = CASE WHEN $13 THEN TRUE ELSE is_default_billing END
       WHERE public_id = $1 AND user_id = $2`,
      [
        addressMatch[1],
        actor.id,
        body.label ?? null,
        body.fullName ?? null,
        body.phone ?? null,
        body.line1 ?? null,
        body.line2 ?? null,
        body.city ?? null,
        body.region ?? null,
        body.postalCode ?? null,
        body.country ?? null,
        Boolean(body.defaultShipping),
        Boolean(body.defaultBilling),
      ],
    );
    return json(req, res, 200, { data: { updated: true } });
  }

  if (pathname === `${API}/account/password` && method === "POST") {
    const body = await readJson(req);
    if (!verifyPassword(String(body.currentPassword ?? ""), actor.password_hash)) {
      return json(req, res, 400, { error: "Current password is not correct" });
    }
    if (String(body.password ?? "").length < 8) {
      return json(req, res, 400, { error: "Password must be at least 8 characters" });
    }
    await (await db()).query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [
      actor.id,
      hashPassword(String(body.password)),
    ]);
    return json(req, res, 200, { data: { updated: true } });
  }

  if (pathname === `${API}/account/sessions` && method === "GET") {
    const current = sha256(String(req.headers.authorization ?? "").slice(7));
    const { rows } = await (await db()).query(
      `SELECT public_id, user_agent, ip, created_at, last_seen_at, token_hash = $2 AS current
       FROM auth_sessions
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY last_seen_at DESC`,
      [actor.id, current],
    );
    return json(req, res, 200, { data: rows });
  }

  const sessionMatch = pathname.match(new RegExp(`^${API}/account/sessions/([^/]+)$`));
  if (sessionMatch && method === "DELETE") {
    await (await db()).query(
      `UPDATE auth_sessions SET revoked_at = NOW() WHERE public_id = $1 AND user_id = $2`,
      [sessionMatch[1], actor.id],
    );
    return json(req, res, 200, { data: { revoked: true } });
  }

  if (pathname === `${API}/account/2fa/start` && method === "POST") {
    const body = await readJson(req);
    const methodName = body.method === "authenticator" ? "authenticator" : "otp";
    if (methodName === "authenticator") {
      const secret = base32Encode(randomBytes(20));
      await (await db()).query(
        `INSERT INTO two_factor (user_id, method, secret, enabled_at)
         VALUES ($1, 'authenticator', $2, NULL)
         ON CONFLICT (user_id) DO UPDATE SET method = 'authenticator', secret = $2, enabled_at = NULL, updated_at = NOW()`,
        [actor.id, secret],
      );
      const label = encodeURIComponent(actor.email || actor.phone || "nexlo");
      return json(req, res, 200, {
        data: { method: "authenticator", secret, uri: `otpauth://totp/Nexlo:${label}?secret=${secret}&issuer=Nexlo` },
      });
    }
    const channel = actor.email ? "email" : "phone";
    const code = await issueCode(actor, "enroll_2fa", actor.email || actor.phone, channel);
    await (await db()).query(
      `INSERT INTO two_factor (user_id, method, enabled_at)
       VALUES ($1, 'otp', NULL)
       ON CONFLICT (user_id) DO UPDATE SET method = 'otp', secret = NULL, enabled_at = NULL, updated_at = NOW()`,
      [actor.id],
    );
    return json(req, res, 200, { data: { method: "otp", devCode: devCodes ? code : undefined } });
  }

  if (pathname === `${API}/account/2fa/confirm` && method === "POST") {
    const body = await readJson(req);
    const { rows } = await (await db()).query(`SELECT method, secret FROM two_factor WHERE user_id = $1`, [actor.id]);
    const factor = rows[0];
    if (!factor) return json(req, res, 400, { error: "Start two-factor setup first" });
    const ok = factor.method === "authenticator"
      ? verifyTotp(factor.secret, body.code)
      : (await consumeCode(actor.id, "enroll_2fa", body.code)) === "ok";
    if (!ok) return json(req, res, 400, { error: "That code is not valid" });
    await (await db()).query(`UPDATE two_factor SET enabled_at = NOW(), updated_at = NOW() WHERE user_id = $1`, [actor.id]);
    return json(req, res, 200, { data: { enabled: factor.method } });
  }

  if (pathname === `${API}/account/seller` && method === "POST") {
    await (await db()).query(`UPDATE users SET is_seller = TRUE, updated_at = NOW() WHERE id = $1`, [actor.id]);
    return json(req, res, 200, {
      data: { isSeller: true, twoFactorRequired: !actor.two_factor_enabled },
    });
  }

  if (pathname === `${API}/account/kyc` && method === "POST") {
    const body = await readJson(req);
    const front = saveKycFile(actor.id, "front", body.front);
    const back = body.back ? saveKycFile(actor.id, "back", body.back) : null;
    const address = saveKycFile(actor.id, "address", body.addressProof);
    if (!front || !address) return json(req, res, 400, { error: "Upload a photo of your ID and an address proof" });
    const publicId = randomUUID();
    await (await db()).query(
      `INSERT INTO kyc_documents (public_id, user_id, doc_type, front_url, back_url, selfie_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
      [publicId, actor.id, String(body.docType || "citizenship"), front, back, address],
    );
    return json(req, res, 201, { data: { id: publicId, status: "pending" } });
  }

  if (pathname === `${API}/account/feedback` && method === "GET") {
    const score = await feedbackFor(actor.id);
    const received = await (await db()).query(
      `SELECT f.public_id, f.rating, f.comment, f.created_at, f.direction, f.reply,
              f.item_as_described, f.communication, f.shipping_time, f.shipping_cost,
              COALESCE(p.display_name, u.email, u.phone) AS from_name
       FROM feedback f
       JOIN users u ON u.id = f.buyer_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE f.seller_id = $1
       ORDER BY f.created_at DESC`,
      [actor.id],
    );
    const left = await (await db()).query(
      `SELECT f.public_id, f.rating, f.comment, f.created_at, f.direction, f.reply,
              COALESCE(p.display_name, u.email, u.phone) AS to_name
       FROM feedback f
       JOIN users u ON u.id = f.seller_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE f.buyer_id = $1
       ORDER BY f.created_at DESC`,
      [actor.id],
    );
    return json(req, res, 200, {
      score,
      level: actor.seller_level,
      received: received.rows,
      left: left.rows,
    });
  }

  if (pathname === `${API}/account/feedback` && method === "POST") {
    const body = await readJson(req);
    const seller = await findUser(body.sellerId);
    if (!seller || seller.id === actor.id) return json(req, res, 400, { error: "Choose another seller" });
    const rating = ["positive", "neutral", "negative"].includes(body.rating) ? body.rating : null;
    if (!rating) return json(req, res, 400, { error: "Rating must be positive, neutral, or negative" });
    await (await db()).query(
      `INSERT INTO feedback (public_id, seller_id, buyer_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (seller_id, buyer_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment`,
      [randomUUID(), seller.id, actor.id, rating, body.comment ?? null],
    );
    const counts = await (await db()).query(
      `SELECT
         COUNT(*) FILTER (WHERE rating = 'positive') AS positive_count,
         COUNT(*) FILTER (WHERE rating = 'neutral') AS neutral_count,
         COUNT(*) FILTER (WHERE rating = 'negative') AS negative_count
       FROM feedback WHERE seller_id = $1`,
      [seller.id],
    );
    const row = counts.rows[0];
    await (await db()).query(
      `INSERT INTO feedback_scores (user_id, positive_count, neutral_count, negative_count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET positive_count = EXCLUDED.positive_count,
           neutral_count = EXCLUDED.neutral_count,
           negative_count = EXCLUDED.negative_count`,
      [seller.id, row.positive_count, row.neutral_count, row.negative_count],
    );
    const level = await recomputeLevel(seller.id);
    return json(req, res, 200, { data: { level } });
  }

  if (pathname === `${API}/account/appeals` && method === "GET") {
    const { rows } = await (await db()).query(
      `SELECT a.public_id, a.message, a.status, a.resolution, a.created_at, c.action, c.reason
       FROM appeals a
       LEFT JOIN account_actions c ON c.id = a.action_id
       WHERE a.user_id = $1 ORDER BY a.created_at DESC`,
      [actor.id],
    );
    return json(req, res, 200, { data: rows, status: actor.status });
  }

  if (pathname === `${API}/account/appeals` && method === "POST") {
    const body = await readJson(req);
    const message = String(body.message ?? "").trim();
    if (message.length < 8) return json(req, res, 400, { error: "Tell us what you want reviewed" });
    if (actor.status !== "restricted" && actor.status !== "suspended") {
      return json(req, res, 400, { error: "This account is not restricted" });
    }
    const { rows: actions } = await (await db()).query(
      `SELECT id FROM account_actions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [actor.id],
    );
    await (await db()).query(
      `INSERT INTO appeals (public_id, user_id, action_id, message) VALUES ($1, $2, $3, $4)`,
      [randomUUID(), actor.id, actions[0]?.id ?? null, message],
    );
    return json(req, res, 201, { data: { status: "pending" } });
  }

  if (pathname === `${API}/admin/status` && method === "GET") {
    const { rows } = await (await db()).query(`SELECT COUNT(*)::int AS count FROM users WHERE is_staff = TRUE`);
    let unreadMessages = 0;
    let pendingKyc = 0;
    let pendingAppeals = 0;
    try {
      unreadMessages = Number((await (await db()).query(`SELECT COUNT(*)::int AS c FROM listing_questions WHERE answer IS NULL`)).rows[0]?.c || 0);
      pendingKyc = Number((await (await db()).query(`SELECT COUNT(*)::int AS c FROM kyc_documents WHERE status = 'pending'`)).rows[0]?.c || 0);
      pendingAppeals = Number((await (await db()).query(`SELECT COUNT(*)::int AS c FROM appeals WHERE status = 'pending'`)).rows[0]?.c || 0);
    } catch {
      /* optional tables */
    }
    return json(req, res, 200, {
      staffExists: rows[0].count > 0,
      youAreStaff: actor.is_staff,
      unreadMessages,
      pendingKyc,
      pendingAppeals,
    });
  }

  if (pathname === `${API}/admin/claim` && method === "POST") {
    const { rows } = await (await db()).query(`SELECT COUNT(*)::int AS count FROM users WHERE is_staff = TRUE`);
    if (rows[0].count > 0 && !actor.is_staff) return json(req, res, 403, { error: "A staff account already exists" });
    await (await db()).query(`UPDATE users SET is_staff = TRUE, status = 'active', updated_at = NOW() WHERE id = $1`, [actor.id]);
    return json(req, res, 200, { data: { isStaff: true } });
  }

  if (!pathname.startsWith(`${API}/admin`)) return false;
  if (!actor?.is_staff && pathname !== `${API}/admin/status` && pathname !== `${API}/admin/claim`) {
    return json(req, res, 403, { error: "Staff only" });
  }
  if (!actor) return json(req, res, 401, { error: "Sign in required" });

  if (pathname === `${API}/admin/kyc` && method === "GET") {
    const { rows } = await (await db()).query(
      `SELECT k.public_id, k.doc_type, k.status, k.rejection_reason, k.created_at,
              u.email, u.public_id AS user_id, p.display_name
       FROM kyc_documents k
       JOIN users u ON u.id = k.user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       ORDER BY k.created_at DESC LIMIT 50`,
    );
    return json(req, res, 200, { data: rows });
  }

  const kycDecision = pathname.match(new RegExp(`^${API}/admin/kyc/([^/]+)$`));
  if (kycDecision && method === "POST") {
    const body = await readJson(req);
    const decision = body.decision === "approved" ? "approved" : "rejected";
    if (decision === "rejected" && !String(body.reason ?? "").trim()) {
      return json(req, res, 400, { error: "A rejection needs a reason" });
    }
    await (await db()).query(
      `UPDATE kyc_documents
       SET status = $2, rejection_reason = $3, reviewed_by = $4, reviewed_at = NOW()
       WHERE public_id = $1`,
      [kycDecision[1], decision, decision === "rejected" ? body.reason : null, actor.id],
    );
    return json(req, res, 200, { data: { status: decision } });
  }

  if (pathname === `${API}/admin/users` && method === "GET") {
    const q = `%${String(ctx.searchParams.get("q") ?? "").trim().toLowerCase()}%`;
    const { rows } = await (await db()).query(
      `SELECT u.public_id, u.email, u.phone, u.username, u.status, u.seller_level, u.is_seller, u.is_staff,
              u.created_at, u.account_type, p.display_name, p.first_name, p.last_name, p.avatar_url, p.country
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.deleted_at IS NULL AND ($1 = '%%' OR lower(u.email) LIKE $1 OR lower(COALESCE(p.display_name,'')) LIKE $1 OR lower(COALESCE(u.username,'')) LIKE $1)
       ORDER BY u.created_at DESC LIMIT 80`,
      [q],
    );
    return json(req, res, 200, { data: rows });
  }

  const userPatch = pathname.match(new RegExp(`^${API}/admin/users/([^/]+)$`));
  if (userPatch && method === "PATCH") {
    const body = await readJson(req);
    const target = await findUser(userPatch[1]);
    if (!target) return json(req, res, 404, { error: "User not found" });
    if (typeof body.staff === "boolean") {
      await (await db()).query(`UPDATE users SET is_staff = $2, updated_at = NOW() WHERE id = $1`, [target.id, body.staff]);
    }
    if (typeof body.seller === "boolean") {
      await (await db()).query(`UPDATE users SET is_seller = $2, updated_at = NOW() WHERE id = $1`, [target.id, body.seller]);
    }
    if (body.status && ["active", "restricted", "suspended", "pending"].includes(body.status)) {
      await (await db()).query(`UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1`, [target.id, body.status]);
    }
    return json(req, res, 200, { data: { id: target.public_id } });
  }

  if (pathname === `${API}/admin/actions` && method === "POST") {
    const body = await readJson(req);
    const action = ["restrict", "suspend", "restore"].includes(body.action) ? body.action : null;
    const reason = String(body.reason ?? "").trim();
    if (!action || reason.length < 3) return json(req, res, 400, { error: "Choose an action and a reason" });
    const target = await findUser(body.userId);
    if (!target) return json(req, res, 404, { error: "User not found" });
    const status = action === "restore" ? "active" : action === "suspend" ? "suspended" : "restricted";
    await (await db()).query(`UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1`, [target.id, status]);
    await (await db()).query(
      `INSERT INTO account_actions (public_id, user_id, action, reason, until_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), target.id, action, reason, body.until || null, actor.id],
    );
    return json(req, res, 200, { data: { status } });
  }

  if (pathname === `${API}/admin/appeals` && method === "GET") {
    const { rows } = await (await db()).query(
      `SELECT a.public_id, a.message, a.status, a.created_at, u.email, u.public_id AS user_id, p.display_name
       FROM appeals a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE a.status = 'pending'
       ORDER BY a.created_at`,
    );
    return json(req, res, 200, { data: rows });
  }

  const appealDecision = pathname.match(new RegExp(`^${API}/admin/appeals/([^/]+)$`));
  if (appealDecision && method === "POST") {
    const body = await readJson(req);
    const decision = body.decision === "overturned" ? "overturned" : "upheld";
    const { rows } = await (await db()).query(`SELECT user_id FROM appeals WHERE public_id = $1`, [appealDecision[1]]);
    if (!rows[0]) return json(req, res, 404, { error: "Appeal not found" });
    await (await db()).query(
      `UPDATE appeals SET status = $2, resolution = $3, reviewed_by = $4, reviewed_at = NOW() WHERE public_id = $1`,
      [appealDecision[1], decision, body.resolution ?? null, actor.id],
    );
    if (decision === "overturned") {
      await (await db()).query(`UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1`, [rows[0].user_id]);
      await (await db()).query(
        `INSERT INTO account_actions (public_id, user_id, action, reason, created_by)
         VALUES ($1, $2, 'restore', $3, $4)`,
        [randomUUID(), rows[0].user_id, body.resolution || "Appeal overturned", actor.id],
      );
    }
    return json(req, res, 200, { data: { status: decision } });
  }

  if (await handleStaffExtras(req, res, ctx, actor)) return true;

  return false;
}

export function readKycFile(userId, file) {
  const path = join(kycDir, String(userId), file);
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

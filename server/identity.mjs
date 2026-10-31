import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { hashPassword, passwordPolicyError, verifyPassword } from "./passwords.mjs";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, initDb } from "./db.mjs";
import { rateLimit, RateLimitConfig, clearRateLimit } from "./security/rate-limit.mjs";
import { deliverCode, maskDestination } from "./mail.mjs";
import { nepalMobileDigits, normalizePhone, phoneLookupKeys } from "./phones.mjs";
import { handleStaffExtras } from "./staff.mjs";
import { cdnify } from "./cdn.mjs";
import { evaluateUser, recordDevice } from "./trust.mjs";
import { clearAvatar, uploadAvatar } from "./upload.mjs";
import {
  beginAuthentication,
  beginRegistration,
  deletePasskey,
  finishAuthentication,
  finishRegistration,
  listPasskeys,
} from "./passkeys.mjs";
import {
  ensureM1Tables,
  handleM1Account,
  handleM1Public,
  listConsents,
  recordConsents,
  signedKycFiles,
  verifyAppleIdToken,
  verifyFacebookToken,
} from "./m1-identity.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const kycDir = join(__dirname, "..", ".data", "kyc");
const appealsDir = join(__dirname, "..", ".data", "appeals");
mkdirSync(appealsDir, { recursive: true });
const API = "/api/v1";
const devCodes = process.env.NODE_ENV !== "production";
const VERIFY_OTP_SECONDS = 30;
const VERIFY_RESEND_SECONDS = 30;

/** Personal and business storefront accounts skip OTP/2FA so QA can sign in with a password. Staff still use 2FA. */
function skipStorefrontOtp(user) {
  return Boolean(user) && !user.is_staff;
}

async function activatePendingStorefrontUser(user) {
  if (user.status !== "pending") return user;
  const verifiedCol = user.email ? "email_verified_at" : "phone_verified_at";
  await (await db()).query(
    `UPDATE users SET status = 'active', ${verifiedCol} = COALESCE(${verifiedCol}, NOW()), updated_at = NOW() WHERE id = $1`,
    [user.id],
  );
  user.status = "active";
  return user;
}

async function db() {
  if (!pool) await initDb();
  return pool;
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
  const { key, e164, last10 } = phoneLookupKeys(identifier);
  const { rows } = await (await db()).query(
    `SELECT u.*, p.display_name, p.first_name, p.last_name, p.country, p.bio, p.avatar_url, p.buyer_only,
            b.legal_name, b.registration_country, b.tax_id, b.website,
            t.method AS two_factor_method, t.enabled_at AS two_factor_enabled, t.secret
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     LEFT JOIN business_profiles b ON b.user_id = u.id
     LEFT JOIN two_factor t ON t.user_id = u.id
     WHERE u.deleted_at IS NULL
       AND (
         lower(u.email) = $1
         OR u.phone = $1
         OR ($2 <> '' AND u.phone = $2)
         OR ($3 <> '' AND right(regexp_replace(COALESCE(u.phone, ''), '\\D', '', 'g'), 10) = $3)
         OR lower(u.username) = $1
         OR u.public_id::text = $1
       )`,
    [key, e164, last10],
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

function blankToNull(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

async function enableSeller(userId) {
  await (await db()).query(`UPDATE users SET is_seller = TRUE, updated_at = NOW() WHERE id = $1`, [userId]);
  await (await db()).query(`UPDATE user_profiles SET buyer_only = FALSE WHERE user_id = $1`, [userId]);
}

function kycStatusLabel(status) {
  if (status === "pending") return "Pending Review";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Requires Additional Documents";
  return status || "Not submitted";
}

function presentAdminKyc(row) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.display_name || row.email;
  return {
    public_id: row.public_id,
    applicationId: row.public_id,
    doc_type: row.doc_type,
    status: row.status,
    statusLabel: kycStatusLabel(row.status),
    rejection_reason: row.rejection_reason,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at || null,
    email: row.email,
    user_id: row.user_id,
    display_name: name,
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    pan: row.tax_id || null,
    is_seller: Boolean(row.is_seller),
    files: signedKycFiles(row.public_id, { front: row.front_url, back: row.back_url, selfie: row.selfie_url }),
  };
}

async function ensureFollowsTable() {
  await (await db()).query(`
    CREATE TABLE IF NOT EXISTS seller_follows (
      follower_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, seller_id)
    )
  `);
}

async function ensureStandingSchema() {
  await (await db()).query(`ALTER TABLE appeals ADD COLUMN IF NOT EXISTS evidence_url TEXT`);
  await (await db()).query(`
    DO $$ BEGIN
      ALTER TABLE account_actions DROP CONSTRAINT IF EXISTS account_actions_action_check;
      ALTER TABLE account_actions ADD CONSTRAINT account_actions_action_check
        CHECK (action IN ('warn', 'restrict', 'suspend', 'restore'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
}

async function latestAction(userId) {
  const { rows } = await (await db()).query(
    `SELECT action, reason, until_at, created_at FROM account_actions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

function standingKind(action) {
  if (action === "warn") return "Warning";
  if (action === "restrict") return "Temporary Suspension";
  if (action === "suspend") return "Suspension";
  return null;
}

function presentStanding(status, action) {
  const blocked = status === "restricted" || status === "suspended";
  const kind = standingKind(action?.action);
  const restored = action?.action === "restore";
  return {
    status,
    action: restored ? null : action?.action || null,
    kind: restored ? null : kind,
    reason: restored ? null : action?.reason || null,
    untilAt: restored ? null : action?.until_at || null,
    limits: {
      canBuy: !blocked,
      canSell: !blocked,
      canBid: !blocked,
    },
    canAppeal: Boolean((blocked || action?.action === "warn") && !restored),
  };
}

function saveAppealFile(userId, dataUrl) {
  const match = String(dataUrl).match(/^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 32 || bytes.length > 5_000_000) return null;
  const ext = match[1].includes("png") ? "png" : match[1].includes("pdf") ? "pdf" : "jpg";
  const dir = join(appealsDir, String(userId));
  mkdirSync(dir, { recursive: true });
  const file = `evidence-${randomUUID()}.${ext}`;
  writeFileSync(join(dir, file), bytes);
  return file;
}

function publicUser(user, score, kyc, action) {
  return {
    id: user.public_id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    accountType: user.account_type,
    status: user.status,
    sellerLevel: user.seller_level,
    isSeller: Boolean(user.is_seller) || user.account_type === "business",
    isStaff: user.is_staff,
    staffRole: user.staff_role || (user.is_staff ? "super_admin" : "none"),
    displayName: blankToNull(user.display_name) || user.username || blankToNull(user.legal_name) || null,
    firstName: blankToNull(user.first_name),
    lastName: blankToNull(user.last_name),
    country: user.country,
    bio: user.bio,
    avatarUrl: cdnify(user.avatar_url) || null,
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
      ? {
          id: kyc.public_id,
          type: kyc.doc_type,
          status: kyc.status,
          statusLabel: kycStatusLabel(kyc.status),
          reason: kyc.rejection_reason,
        }
      : null,
    createdAt: user.created_at,
    standing: presentStanding(user.status, action),
  };
}

async function loadPublic(user) {
  const [score, kyc, social, consents, action] = await Promise.all([
    feedbackFor(user.id),
    latestKyc(user.id),
    (await db()).query(`SELECT provider FROM social_accounts WHERE user_id = $1`, [user.id]),
    listConsents(user.id).catch(() => null),
    latestAction(user.id),
  ]);
  return {
    ...publicUser(user, score, kyc, action),
    social: social.rows.map((row) => row.provider),
    consents: consents?.currentAccepted ?? null,
    policyVersions: consents?.current ?? null,
  };
}

function deliveryFields(delivery, code) {
  return {
    sent: Boolean(delivery?.sent),
    skipped: Boolean(delivery?.skipped),
    destinationMasked: delivery?.masked,
    deliveryError: delivery?.sent ? undefined : delivery?.userMessage,
    devCode: devCodes ? code : undefined,
  };
}

function codeTtlSeconds(purpose) {
  return purpose === "verify" ? VERIFY_OTP_SECONDS : 600;
}

function appOrigin(req) {
  const env = String(process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || process.env.WEBAUTHN_ORIGIN || "").replace(/\/$/, "");
  if (env) return env.replace(/:4000$/, ":3000");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000").split(",")[0].trim();
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  return `${proto}://${host}`.replace(/:4000$/, ":3000");
}

async function issueCode(user, purpose, destination, channel, extras = {}) {
  const code = String(randomInt(100000, 1000000));
  const pool = await db();
  await pool.query(
    `UPDATE verification_codes
     SET expires_at = NOW()
     WHERE user_id = $1 AND purpose = $2 AND verified_at IS NULL AND expires_at > NOW()`,
    [user.id, purpose],
  );
  await pool.query(
    `INSERT INTO verification_codes (user_id, channel, purpose, destination, code_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + ($6 * INTERVAL '1 second'))`,
    [user.id, channel, purpose, destination, hashCode(code), codeTtlSeconds(purpose)],
  );
  const delivery = await deliverCode(channel, destination, code, purpose, extras);
  if (!delivery?.sent) {
    console.error("[auth] code email did not send", purpose, delivery?.userMessage || delivery?.skipped);
  }
  return { code, delivery };
}

async function consumeCode(userId, purpose, code) {
  const given = String(code ?? "").replace(/\s/g, "");
  const { rows } = await (await db()).query(
    `SELECT id, code_hash, attempts, expires_at, verified_at
     FROM verification_codes
     WHERE user_id = $1 AND purpose = $2 AND verified_at IS NULL
     ORDER BY created_at DESC`,
    [userId, purpose],
  );
  if (!rows.length) return "missing";
  const now = Date.now();
  const live = (row) => new Date(row.expires_at).getTime() > now;
  const match = rows.find((row) => codesMatch(given, row.code_hash));
  if (match) {
    if (!live(match)) return "expired";
    if (match.attempts >= 5) return "locked";
    await (await db()).query(`UPDATE verification_codes SET verified_at = NOW() WHERE id = $1`, [match.id]);
    return "ok";
  }
  const active = rows.filter(live);
  if (!active.length) return "expired";
  const unlocked = active.filter((row) => row.attempts < 5);
  if (!unlocked.length) return "locked";
  await (await db()).query(`UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1`, [unlocked[0].id]);
  return "invalid";
}

async function verifyResendWait(userId) {
  const { rows } = await (await db()).query(
    `SELECT created_at FROM verification_codes
     WHERE user_id = $1 AND purpose = 'verify'
     ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  if (!rows[0]) return 0;
  const waitMs = VERIFY_RESEND_SECONDS * 1000 - (Date.now() - new Date(rows[0].created_at).getTime());
  return waitMs > 0 ? Math.ceil(waitMs / 1000) : 0;
}

function clientMeta(req, remember) {
  const days = remember ? 30 : 1;
  const forwarded = String(req.headers["x-forwarded-for"] ?? req.headers["x-real-ip"] ?? req.socket?.remoteAddress ?? "");
  return {
    agent: String(req.headers["user-agent"] ?? "Unknown device").slice(0, 240),
    ip: forwarded.split(",")[0].trim().slice(0, 64),
    expires: new Date(Date.now() + days * 86400000).toISOString(),
  };
}

function jwtSecret() {
  return String(process.env.JWT_SECRET || process.env.SESSION_SECRET || "nexlo-dev-jwt");
}

function signSessionJwt({ sub, sid, exp }) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      sid,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(new Date(exp).getTime() / 1000),
    }),
  ).toString("base64url");
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", jwtSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function readSessionJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = createHmac("sha256", jwtSecret()).update(data).digest("base64url");
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function openSession(user, req, remember) {
  const sessionId = randomUUID();
  const meta = clientMeta(req, remember);
  const token = signSessionJwt({
    sub: user.public_id || user.id,
    sid: sessionId,
    exp: meta.expires,
  });
  await (await db()).query(
    `INSERT INTO auth_sessions (public_id, user_id, token_hash, user_agent, ip, remember, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [sessionId, user.id, sha256(token), meta.agent, meta.ip, Boolean(remember), meta.expires],
  );
  return token;
}

async function sessionUser(req) {
  const header = String(req.headers.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  if (token.includes(".") && !readSessionJwt(token)) return null;
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

async function createChallenge(user, purpose, minutes = 10) {
  const token = randomBytes(24).toString("hex");
  await (await db()).query(
    `INSERT INTO auth_challenges (token_hash, user_id, purpose, expires_at)
     VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 minute'))`,
    [sha256(token), user.id, purpose, minutes],
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

async function expireChallenge(token, purpose) {
  await (await db()).query(
    `UPDATE auth_challenges SET expires_at = NOW() WHERE token_hash = $1 AND purpose = $2`,
    [sha256(String(token ?? "")), purpose],
  );
}

async function startTwoFactorSetup(user, requestedMethod) {
  const methodName = requestedMethod === "authenticator" ? "authenticator" : "otp";
  if (methodName === "authenticator") {
    const secret = base32Encode(randomBytes(20));
    await (await db()).query(
      `INSERT INTO two_factor (user_id, method, secret, enabled_at)
       VALUES ($1, 'authenticator', $2, NULL)
       ON CONFLICT (user_id) DO UPDATE SET method = 'authenticator', secret = $2, enabled_at = NULL, updated_at = NOW()`,
      [user.id, secret],
    );
    const label = encodeURIComponent(user.email || user.phone || "nexlo");
    return { ok: true, data: { method: "authenticator", secret, uri: `otpauth://totp/Nexlo:${label}?secret=${secret}&issuer=Nexlo` } };
  }
  const dest = user.email || user.phone;
  if (!dest) return { ok: false, error: "This account has no email or phone for a code" };
  const channel = user.email ? "email" : "phone";
  const issued = await issueCode(user, "enroll_2fa", dest, channel);
  await (await db()).query(
    `INSERT INTO two_factor (user_id, method, enabled_at)
     VALUES ($1, 'otp', NULL)
     ON CONFLICT (user_id) DO UPDATE SET method = 'otp', secret = NULL, enabled_at = NULL, updated_at = NOW()`,
    [user.id],
  );
  return { ok: true, data: { method: "otp", ...deliveryFields(issued.delivery, issued.code) } };
}

async function confirmTwoFactorSetup(user, code) {
  const { rows } = await (await db()).query(`SELECT method, secret FROM two_factor WHERE user_id = $1`, [user.id]);
  const factor = rows[0];
  if (!factor) return { ok: false, error: "Start two-factor setup first" };
  const matched = factor.method === "authenticator"
    ? verifyTotp(factor.secret, code)
    : (await consumeCode(user.id, "enroll_2fa", code)) === "ok";
  if (!matched) return { ok: false, error: "That code is not valid" };
  await (await db()).query(`UPDATE two_factor SET enabled_at = NOW(), updated_at = NOW() WHERE user_id = $1`, [user.id]);
  return { ok: true, method: factor.method };
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

function kycCryptoKey() {
  return createHash("sha256")
    .update(process.env.KYC_URL_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET || "nexlo-kyc-dev")
    .digest();
}

function encryptDocNumber(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", kycCryptoKey(), iv);
  const enc = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

function saveKycFile(userId, name, dataUrl) {
  const match = String(dataUrl).match(/^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 32 || bytes.length > 5_000_000) return null;
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

async function findSocialUser(provider, sub, email) {
  const linked = await (await db()).query(
    `SELECT user_id FROM social_accounts WHERE provider = $1 AND provider_user_id = $2`,
    [provider, sub],
  );
  if (linked.rows[0]) {
    const { rows } = await (await db()).query(
      `SELECT email, phone, public_id FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [linked.rows[0].user_id],
    );
    if (rows[0]) return findUser(rows[0].email || rows[0].phone || rows[0].public_id);
  }
  if (email) return findUser(email);
  return null;
}

async function finishSocial(req, res, json, provider, sub, email, name) {
  if (!sub) return json(req, res, 400, { error: `${provider} sign-in did not include an account id` });
  let user = await findSocialUser(provider, sub, email);
  if (!user) {
    if (!email || !email.includes("@")) {
      return json(req, res, 400, { error: `${provider} did not share an email. Grant email access or register with email.` });
    }
    const { rows } = await (await db()).query(
      `INSERT INTO users (public_id, email, status, email_verified_at, account_type)
       VALUES ($1, $2, 'active', NOW(), 'individual') RETURNING id, public_id, email`,
      [randomUUID(), email],
    );
    await (await db()).query(`INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2)`, [
      rows[0].id,
      name || email.split("@")[0],
    ]);
    await (await db()).query(`INSERT INTO feedback_scores (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [rows[0].id]);
    await recordConsents(rows[0].id, ["privacy", "terms"], req).catch(() => {});
    user = await findUser(email);
  }
  await (await db()).query(
    `INSERT INTO social_accounts (user_id, provider, provider_user_id, email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (provider, provider_user_id) DO NOTHING`,
    [user.id, provider, sub, email || user.email],
  );
  if (!skipStorefrontOtp(user) && (user.is_seller || user.is_staff) && !user.two_factor_enabled) {
    const challengeToken = await createChallenge(user, "enroll_2fa", 20);
    return json(req, res, 200, { step: "enroll", challengeToken });
  }
  const token = await openSession(user, req, true);
  return json(req, res, 200, { token, user: await loadPublic(user) });
}

export async function handleIdentity(req, res, ctx) {
  const { json, readJson, pathname, method } = ctx;
  const inIdentity =
    pathname.startsWith(`${API}/auth`) ||
    pathname.startsWith(`${API}/account`) ||
    pathname.startsWith(`${API}/admin`) ||
    pathname.startsWith(`${API}/kyc`) ||
    pathname.startsWith(`${API}/members`);
  if (!inIdentity) return false;
  await ensureM1Tables();
  await ensureStandingSchema();
  if (await handleM1Public(req, res, ctx)) return true;
  await promoteAdmin();

  if (pathname === `${API}/auth/register` && method === "POST") {
    // Rate limit check
    const rateLimitResult = rateLimit(req, RateLimitConfig.AUTH_REGISTER);
    if (rateLimitResult) {
      return json(req, res, rateLimitResult.status, rateLimitResult.body, rateLimitResult.headers);
    }

    const body = await readJson(req);
    const email = String(body.email ?? "").trim().toLowerCase() || null;
    const rawPhone = String(body.phone ?? "").replace(/\s/g, "") || null;
    let phone = null;
    if (rawPhone) {
      const local = nepalMobileDigits(rawPhone);
      if (!local) {
        return json(req, res, 400, {
          error: "Enter a valid 10-digit Nepal mobile number starting with 97 or 98.",
        });
      }
      phone = `+977${local}`;
    }
    const password = String(body.password ?? "");
    const accountType = body.accountType === "business" ? "business" : "individual";
    const firstName = String(body.firstName ?? "").trim() || null;
    const lastName = String(body.lastName ?? "").trim() || null;
    const displayName = String(body.displayName ?? "").trim() || [firstName, lastName].filter(Boolean).join(" ") || null;
    const country = String(body.country ?? "").trim() || null;
    if (!email && !phone) return json(req, res, 400, { error: "Email or phone is required" });
    if (email && !email.includes("@")) return json(req, res, 400, { error: "Enter a valid email" });
    const passwordError = passwordPolicyError(password);
    if (passwordError) return json(req, res, 400, { error: passwordError });
    if (email) {
      const takenEmail = await (await db()).query(
        `SELECT 1 FROM users WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1`,
        [email],
      );
      if (takenEmail.rows[0]) return json(req, res, 409, { error: "Email already registered" });
    }
    if (phone) {
      const takenPhone = await (await db()).query(
        `SELECT 1 FROM users
         WHERE deleted_at IS NULL
           AND right(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $1
         LIMIT 1`,
        [nepalMobileDigits(phone)],
      );
      if (takenPhone.rows[0]) return json(req, res, 409, { error: "Phone already registered" });
    }
    const client = await (await db()).connect();
    try {
      await client.query("BEGIN");
      const isSeller = accountType === "business";
      const { rows } = await client.query(
        `INSERT INTO users (public_id, email, phone, password_hash, status, account_type, is_seller, email_verified_at, phone_verified_at)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6, NULL, NULL)
         RETURNING id, public_id, email, phone`,
        [randomUUID(), email, phone, await hashPassword(password), accountType, isSeller],
      );
      const user = rows[0];
      await client.query(
        `INSERT INTO user_profiles (user_id, first_name, last_name, display_name, country, buyer_only)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.id, firstName, lastName, displayName, country, isSeller ? false : Boolean(body.buyerOnly)],
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
      await client.query("COMMIT");
      await recordConsents(user.id, ["privacy", "terms"], req).catch(() => {});
      const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
      const risk = await evaluateUser(user.id, { kind: "register", ip, email, phone }).catch(() => null);
      if (risk?.blocked) {
        await (await db()).query(`UPDATE users SET status = 'restricted' WHERE id = $1`, [user.id]);
        return json(req, res, 201, {
          data: { id: user.public_id, skipVerify: true, review: true },
        });
      }
      await recordDevice(user.id, body.deviceHash).catch(() => {});
      const full = await findUser(email || phone);
      const destination = email || phone;
      const channel = email ? "email" : "phone";
      const issued = await issueCode(full, "verify", destination, channel);
      return json(req, res, 201, {
        data: {
          id: user.public_id,
          skipVerify: false,
          destination,
          channel,
          review: Boolean(risk?.flagged),
          expiresIn: VERIFY_OTP_SECONDS,
          resendAfter: VERIFY_RESEND_SECONDS,
          ...deliveryFields(issued.delivery, issued.code),
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "23505") {
        const constraint = String(err.constraint || err.detail || "");
        if (constraint.includes("email")) return json(req, res, 409, { error: "Email already registered" });
        if (constraint.includes("phone")) return json(req, res, 409, { error: "Phone already registered" });
        return json(req, res, 409, { error: "Email already registered" });
      }
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
    if (!user) return json(req, res, 200, { data: { sent: true, destinationMasked: maskDestination(body.identifier) } });
    const wait = await verifyResendWait(user.id);
    if (wait > 0) {
      res.setHeader("Retry-After", String(wait));
      return json(req, res, 429, { error: "Wait before requesting a new code", retryAfter: wait });
    }
    const identifier = String(body.identifier ?? "").trim();
    const channel = looksLikeEmail(identifier) && user.email ? "email" : user.phone && !looksLikeEmail(identifier) ? "phone" : user.email ? "email" : "phone";
    const destination = channel === "phone" ? user.phone : user.email;
    if (!destination) return json(req, res, 400, { error: "This account has no email or phone" });
    const issued = await issueCode(user, "verify", destination, channel);
    return json(req, res, 200, {
      data: {
        destination,
        channel,
        expiresIn: VERIFY_OTP_SECONDS,
        resendAfter: VERIFY_RESEND_SECONDS,
        ...deliveryFields(issued.delivery, issued.code),
      },
    });
  }

  if (pathname === `${API}/auth/verify` && method === "POST") {
    // Rate limit check
    const rateLimitResult = rateLimit(req, RateLimitConfig.AUTH_VERIFY);
    if (rateLimitResult) {
      return json(req, res, rateLimitResult.status, rateLimitResult.body, rateLimitResult.headers);
    }

    const body = await readJson(req);
    const user = await findUser(body.identifier);
    if (!user) return json(req, res, 400, { error: "Account not found" });
    const result = await consumeCode(user.id, "verify", body.code);
    if (result === "expired") return json(req, res, 400, { error: "Code expired" });
    if (result !== "ok") return json(req, res, 400, { error: "That code is not valid" });
    const channel = looksLikeEmail(String(body.identifier)) ? "email_verified_at" : "phone_verified_at";
    await (await db()).query(
      `UPDATE users SET status = 'active', ${channel} = NOW(), updated_at = NOW() WHERE id = $1`,
      [user.id],
    );
    const verified = (await findUser(body.identifier)) ?? user;
    verified.status = "active";
    const token = await openSession(verified, req, true);
    return json(req, res, 200, { token, user: await loadPublic(verified) });
  }

  if (pathname === `${API}/auth/login` && method === "POST") {
    const body = await readJson(req);
    const accountKey = body.identifier ?? body.email;
    const rateLimitResult = rateLimit(req, RateLimitConfig.AUTH_LOGIN, accountKey);
    if (rateLimitResult) {
      return json(req, res, rateLimitResult.status, rateLimitResult.body, rateLimitResult.headers);
    }

    const user = await findUser(accountKey);
    if (!user || !(await verifyPassword(String(body.password ?? ""), user.password_hash))) {
      return json(req, res, 401, { error: "Invalid email or password" });
    }
    
    // Clear rate limit on successful authentication
    clearRateLimit(req, accountKey);
    
    await refreshStanding(user);
    if (user.status === "pending") {
      if (skipStorefrontOtp(user)) {
        await activatePendingStorefrontUser(user);
      } else {
        return json(req, res, 403, {
          error: "Verify the code we sent before signing in. Open Verify and tap Resend if it did not arrive.",
        });
      }
    }
    if (user.two_factor_enabled) {
      const challengeToken = await createChallenge(user, "login_2fa");
      let issued;
      if (user.two_factor_method === "otp") {
        const channel = user.email ? "email" : "phone";
        issued = await issueCode(user, "login_2fa", user.email || user.phone, channel);
      }
      return json(req, res, 200, {
        step: "challenge",
        method: user.two_factor_method,
        challengeToken,
        ...(issued ? deliveryFields(issued.delivery, issued.code) : {}),
      });
    }
    if (!skipStorefrontOtp(user)) {
      const must2fa = user.is_seller || user.is_staff;
      if (must2fa && !user.two_factor_enabled && !(body.adminPortal && user.is_staff)) {
        const challengeToken = await createChallenge(user, "enroll_2fa", 20);
        return json(req, res, 200, { step: "enroll", challengeToken });
      }
    }
    const token = await openSession(user, req, body.remember !== false);
    return json(req, res, 200, { token, user: await loadPublic(user) });
  }

  if (pathname === `${API}/auth/passkeys/options` && method === "POST") {
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
    return json(req, res, 200, await beginAuthentication(req, body.identifier));
  }

  if (pathname === `${API}/auth/passkeys` && method === "POST") {
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
    const result = await finishAuthentication(req, body);
    if (!result.ok) return json(req, res, 401, { error: result.error });
    const user = result.user;
    await refreshStanding(user);
    if (user.status === "pending") {
      if (skipStorefrontOtp(user)) await activatePendingStorefrontUser(user);
      else return json(req, res, 403, { error: "Verify the code we sent before signing in." });
    }
    const token = await openSession(user, req, true);
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

  if (pathname === `${API}/auth/2fa/enroll/start` && method === "POST") {
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
    const challenge = await readChallenge(body.challengeToken, "enroll_2fa");
    if (!challenge) return json(req, res, 400, { error: "That sign-in challenge expired. Sign in again." });
    const user = await findUser(challenge.public_id);
    if (!user) return json(req, res, 400, { error: "That sign-in challenge expired. Sign in again." });
    if (user.two_factor_enabled) return json(req, res, 400, { error: "Two-factor is already on. Sign in again." });
    const started = await startTwoFactorSetup(user, body.method);
    if (!started.ok) return json(req, res, 400, { error: started.error });
    return json(req, res, 200, { data: started.data });
  }

  if (pathname === `${API}/auth/2fa/enroll/confirm` && method === "POST") {
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
    const challenge = await readChallenge(body.challengeToken, "enroll_2fa");
    if (!challenge) return json(req, res, 400, { error: "That sign-in challenge expired. Sign in again." });
    const user = await findUser(challenge.public_id);
    if (!user) return json(req, res, 400, { error: "That sign-in challenge expired. Sign in again." });
    const confirmed = await confirmTwoFactorSetup(user, body.code);
    if (!confirmed.ok) return json(req, res, 400, { error: confirmed.error });
    await expireChallenge(body.challengeToken, "enroll_2fa");
    const full = await findUser(user.email || user.phone || user.public_id);
    const token = await openSession(full, req, body.remember !== false);
    return json(req, res, 200, { token, user: await loadPublic(full), data: { enabled: confirmed.method } });
  }

  if (pathname === `${API}/auth/google` && method === "POST") {
    const body = await readJson(req);
    let email = String(body.email ?? "").trim().toLowerCase();
    let name = String(body.name ?? "").trim();
    let sub = String(body.sub ?? "").trim();
    if (!body.idToken) {
      return json(req, res, 400, { error: "Google sign-in requires a Google ID token" });
    }
    const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(body.idToken)}`);
    if (!info.ok) return json(req, res, 401, { error: "Google could not confirm that sign-in" });
    const profile = await info.json();
    const audience = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (audience && profile.aud !== audience) {
      return json(req, res, 401, { error: "Google token audience did not match" });
    }
    email = String(profile.email ?? "").toLowerCase();
    name = profile.name || email;
    sub = profile.sub;
    if (!email || !email.includes("@") || !sub) return json(req, res, 400, { error: "A Google email is required" });
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
    if (!skipStorefrontOtp(user) && (user.is_seller || user.is_staff) && !user.two_factor_enabled) {
      const challengeToken = await createChallenge(user, "enroll_2fa", 20);
      return json(req, res, 200, { step: "enroll", challengeToken });
    }
    const token = await openSession(user, req, true);
    return json(req, res, 200, { token, user: await loadPublic(user) });
  }

  if (pathname === `${API}/auth/apple` && method === "POST") {
    const body = await readJson(req);
    if (!body.idToken) return json(req, res, 400, { error: "Apple sign-in requires an identity token" });
    try {
      const profile = await verifyAppleIdToken(body.idToken);
      const email = String(profile.email || body.email || "").trim().toLowerCase();
      const name = String(body.name || profile.email || "Apple user").trim();
      return await finishSocial(req, res, json, "apple", String(profile.sub), email, name);
    } catch (err) {
      return json(req, res, 401, { error: err instanceof Error ? err.message : "Apple could not confirm that sign-in" });
    }
  }

  if (pathname === `${API}/auth/facebook` && method === "POST") {
    const body = await readJson(req);
    if (!body.accessToken) return json(req, res, 400, { error: "Facebook sign-in requires an access token" });
    try {
      const profile = await verifyFacebookToken(body.accessToken);
      const email = String(profile.email || "").trim().toLowerCase();
      const name = String(profile.name || email || "Facebook user").trim();
      return await finishSocial(req, res, json, "facebook", String(profile.id), email, name);
    } catch (err) {
      return json(req, res, 401, { error: err instanceof Error ? err.message : "Facebook could not confirm that sign-in" });
    }
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
    const resetToken = channel === "email" ? await createChallenge(user, "reset", 30) : null;
    const resetUrl = resetToken ? `${appOrigin(req)}/reset?token=${encodeURIComponent(resetToken)}` : null;
    const issued = await issueCode(user, "reset", destination, channel, { resetUrl });
    return json(req, res, 200, {
      data: {
        destination,
        ...(devCodes && resetUrl ? { resetUrl } : {}),
        ...deliveryFields(issued.delivery, issued.code),
      },
    });
  }

  if (pathname === `${API}/auth/reset` && method === "POST") {
    const body = await readJson(req);
    const passwordError = passwordPolicyError(body.password);
    if (passwordError) return json(req, res, 400, { error: passwordError });
    let user = null;
    if (body.token) {
      const challenge = await readChallenge(body.token, "reset");
      if (!challenge) return json(req, res, 400, { error: "This reset link is invalid or has expired" });
      user = await findUser(challenge.public_id);
      await expireChallenge(body.token, "reset");
    } else {
      user = await findUser(body.identifier);
      if (!user) return json(req, res, 400, { error: "Account not found" });
      const result = await consumeCode(user.id, "reset", body.code);
      if (result === "expired") return json(req, res, 400, { error: "This reset link is invalid or has expired" });
      if (result !== "ok") return json(req, res, 400, { error: "That code is not valid" });
    }
    if (!user) return json(req, res, 400, { error: "Account not found" });
    await (await db()).query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [
      user.id,
      await hashPassword(String(body.password)),
    ]);
    await (await db()).query(`UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [user.id]);
    return json(req, res, 200, { data: { reset: true } });
  }

  const actor = await sessionUser(req);
  if (!actor && pathname.startsWith(`${API}/account`)) return json(req, res, 401, { error: "Sign in required" });
  if (!actor && pathname.startsWith(`${API}/admin`)) return json(req, res, 401, { error: "Sign in required" });
  if (actor) {
    await handleM1Account(req, res, ctx, actor);
    if (res.headersSent) return true;
  }

  if (pathname === `${API}/account` && method === "GET") {
    await refreshStanding(actor);
    return json(req, res, 200, { user: await loadPublic(actor) });
  }

  const followMatch = pathname.match(new RegExp(`^${API}/account/follow/(\\d+)$`));
  if (followMatch && method === "GET") {
    await ensureFollowsTable();
    const { rows } = await (await db()).query(
      `SELECT 1 FROM seller_follows WHERE follower_id = $1 AND seller_id = $2 LIMIT 1`,
      [actor.id, Number(followMatch[1])],
    );
    return json(req, res, 200, { following: Boolean(rows[0]) });
  }

  if (pathname === `${API}/account/follow` && method === "POST") {
    const body = await readJson(req);
    const sellerId = Number(body.sellerId);
    if (!sellerId) return json(req, res, 400, { error: "Seller is required" });
    if (sellerId === Number(actor.id)) return json(req, res, 400, { error: "You cannot follow yourself" });
    await ensureFollowsTable();
    await (await db()).query(
      `INSERT INTO seller_follows (follower_id, seller_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [actor.id, sellerId],
    );
    return json(req, res, 200, { following: true });
  }

  if (pathname === `${API}/account/follow` && method === "DELETE") {
    const body = await readJson(req);
    const sellerId = Number(body.sellerId);
    await ensureFollowsTable();
    await (await db()).query(`DELETE FROM seller_follows WHERE follower_id = $1 AND seller_id = $2`, [actor.id, sellerId]);
    return json(req, res, 200, { following: false });
  }

  if (pathname === `${API}/account/profile/avatar` && method === "POST") {
    const result = await uploadAvatar(req, actor.id);
    if (result.status >= 400) return json(req, res, result.status, result.body);
    const fresh = await findUser(actor.email || actor.phone || actor.public_id);
    return json(req, res, 200, { user: await loadPublic(fresh), avatarUrl: result.body.avatarUrl });
  }

  if (pathname === `${API}/account/profile/avatar` && method === "DELETE") {
    await clearAvatar(actor.id);
    const fresh = await findUser(actor.email || actor.phone || actor.public_id);
    return json(req, res, 200, { user: await loadPublic(fresh), avatarUrl: null });
  }

  if (pathname === `${API}/account/profile` && method === "PATCH") {
    const body = await readJson(req);
    if (body.clearAvatar === true) {
      await clearAvatar(actor.id);
    }
    const firstName = body.firstName != null ? blankToNull(body.firstName) : null;
    const lastName = body.lastName != null ? blankToNull(body.lastName) : null;
    const displayName = body.displayName != null ? blankToNull(body.displayName) : null;
    const bio = body.bio != null ? blankToNull(body.bio) : null;
    const country = body.country != null ? blankToNull(body.country) : null;
    await (await db()).query(
      `INSERT INTO user_profiles (user_id, first_name, last_name, display_name, bio, country)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         first_name = COALESCE(EXCLUDED.first_name, user_profiles.first_name),
         last_name = COALESCE(EXCLUDED.last_name, user_profiles.last_name),
         display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name),
         bio = COALESCE(EXCLUDED.bio, user_profiles.bio),
         country = COALESCE(EXCLUDED.country, user_profiles.country)`,
      [actor.id, firstName, lastName, displayName, bio, country],
    );
    if (body.phone != null && String(body.phone).trim()) {
      const phone = normalizePhone(body.phone);
      if (!phone) return json(req, res, 400, { error: "Enter a valid phone number." });
      if (phone !== normalizePhone(actor.phone)) {
        const taken = await (await db()).query(`SELECT id FROM users WHERE phone = $1 AND id <> $2 LIMIT 1`, [phone, actor.id]);
        if (taken.rows[0]) return json(req, res, 409, { error: "That phone number is already in use." });
        await (await db()).query(
          `UPDATE users SET phone = $2, phone_verified_at = NULL, updated_at = NOW() WHERE id = $1`,
          [actor.id, phone],
        );
      }
    }
    if (typeof body.username === "string") {
      const username = body.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 32);
      if (username.length >= 3) {
        await (await db()).query(`UPDATE users SET username = $2, updated_at = NOW() WHERE id = $1`, [actor.id, username]);
      }
    }
    if (body.accountType === "business" || body.accountType === "individual") {
      await (await db()).query(
        `UPDATE users
         SET account_type = $2,
             is_seller = CASE WHEN $2 = 'business' THEN TRUE ELSE is_seller END,
             updated_at = NOW()
         WHERE id = $1`,
        [actor.id, body.accountType],
      );
      if (body.accountType === "business") {
        await (await db()).query(`UPDATE user_profiles SET buyer_only = FALSE WHERE user_id = $1`, [actor.id]);
      }
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

  if (pathname === `${API}/account/phone/start` && method === "POST") {
    const body = await readJson(req);
    if (!actor.email || !actor.email_verified_at) {
      return json(req, res, 403, { error: "Verify your email before changing your phone number." });
    }
    const phone = normalizePhone(body.phone);
    if (!phone) return json(req, res, 400, { error: "Enter a valid phone number." });
    if (phone === normalizePhone(actor.phone)) {
      return json(req, res, 400, { error: "That is already your phone number." });
    }
    const taken = await (await db()).query(`SELECT id FROM users WHERE phone = $1 AND id <> $2 LIMIT 1`, [phone, actor.id]);
    if (taken.rows[0]) return json(req, res, 409, { error: "That phone number is already in use." });
    const issued = await issueCode(actor, "change_phone", actor.email, "email");
    return json(req, res, 200, {
      data: {
        phone,
        destination: actor.email,
        ...deliveryFields(issued.delivery, issued.code),
      },
    });
  }

  if (pathname === `${API}/account/phone/confirm` && method === "POST") {
    const body = await readJson(req);
    if (!actor.email || !actor.email_verified_at) {
      return json(req, res, 403, { error: "Verify your email before changing your phone number." });
    }
    const phone = normalizePhone(body.phone);
    if (!phone) return json(req, res, 400, { error: "Enter a valid phone number." });
    const result = await consumeCode(actor.id, "change_phone", body.code);
    if (result !== "ok") return json(req, res, 400, { error: "That email code is not valid." });
    try {
      await (await db()).query(
        `UPDATE users SET phone = $2, phone_verified_at = NULL, updated_at = NOW() WHERE id = $1`,
        [actor.id, phone],
      );
    } catch (err) {
      if (err.code === "23505") return json(req, res, 409, { error: "That phone number is already in use." });
      throw err;
    }
    const fresh = await findUser(actor.email || phone || actor.public_id);
    return json(req, res, 200, { user: await loadPublic(fresh) });
  }

  if (pathname === `${API}/account/addresses` && method === "GET") {
    const { rows } = await (await db()).query(
      `SELECT public_id, label, full_name, phone, line1, line2, city, region, postal_code, country,
              is_default_shipping, is_default_billing
       FROM addresses WHERE user_id = $1 ORDER BY is_default_shipping DESC, created_at`,
      [actor.id],
    );
    return json(req, res, 200, { data: rows, addresses: rows });
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
    if (!(await verifyPassword(String(body.currentPassword ?? ""), actor.password_hash))) {
      return json(req, res, 400, { error: "Current password is not correct" });
    }
    const passwordError = passwordPolicyError(body.password);
    if (passwordError) return json(req, res, 400, { error: passwordError });
    await (await db()).query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [
      actor.id,
      await hashPassword(String(body.password)),
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
    const current = sha256(String(req.headers.authorization ?? "").slice(7));
    const { rows } = await (await db()).query(
      `SELECT public_id, token_hash FROM auth_sessions
       WHERE public_id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > NOW()`,
      [sessionMatch[1], actor.id],
    );
    const target = rows[0];
    if (!target) return json(req, res, 404, { error: "That session is no longer active" });
    if (target.token_hash === current) {
      return json(req, res, 400, { error: "You cannot revoke this device. Sign out instead." });
    }
    await (await db()).query(`DELETE FROM auth_sessions WHERE public_id = $1 AND user_id = $2`, [target.public_id, actor.id]);
    return json(req, res, 200, { data: { revoked: true, public_id: target.public_id } });
  }

  if (pathname === `${API}/account/passkeys` && method === "GET") {
    return json(req, res, 200, { data: await listPasskeys(actor.id) });
  }

  if (pathname === `${API}/account/passkeys/options` && method === "POST") {
    return json(req, res, 200, await beginRegistration(req, actor));
  }

  if (pathname === `${API}/account/passkeys` && method === "POST") {
    const body = await readJson(req);
    const result = await finishRegistration(req, actor, body);
    if (!result.ok) return json(req, res, 400, { error: result.error });
    return json(req, res, 201, { data: { saved: true } });
  }

  const passkeyMatch = pathname.match(new RegExp(`^${API}/account/passkeys/(\\d+)$`));
  if (passkeyMatch && method === "DELETE") {
    const removed = await deletePasskey(actor.id, passkeyMatch[1]);
    if (!removed) return json(req, res, 404, { error: "Passkey not found" });
    return json(req, res, 200, { data: { removed: true } });
  }

  if (pathname === `${API}/account/2fa/start` && method === "POST") {
    const body = await readJson(req);
    const started = await startTwoFactorSetup(actor, body.method);
    if (!started.ok) return json(req, res, 400, { error: started.error });
    return json(req, res, 200, { data: started.data });
  }

  if (pathname === `${API}/account/2fa/confirm` && method === "POST") {
    const body = await readJson(req);
    const confirmed = await confirmTwoFactorSetup(actor, body.code);
    if (!confirmed.ok) return json(req, res, 400, { error: confirmed.error });
    return json(req, res, 200, { data: { enabled: confirmed.method } });
  }

  if (pathname === `${API}/account/seller` && method === "POST") {
    await enableSeller(actor.id);
    return json(req, res, 200, {
      data: { isSeller: true, twoFactorRequired: !actor.two_factor_enabled },
    });
  }

  if (pathname === `${API}/account/kyc` && method === "POST") {
    const body = await readJson(req);
    const docType = String(body.docType || "citizenship").toLowerCase();
    if (!["citizenship", "passport"].includes(docType)) {
      return json(req, res, 400, { error: "Use Nepali citizenship or a passport" });
    }
    const latest = await latestKyc(actor.id);
    if (latest?.status === "approved") {
      return json(req, res, 409, { error: "Your identity is already verified" });
    }
    if (latest?.status === "pending") {
      return json(req, res, 409, { error: "Your application is already pending review" });
    }
    const pan = String(body.pan || body.taxId || "").replace(/\s+/g, "").trim();
    const docNumber = String(body.docNumber || body.citizenshipNumber || "").trim();
    const legalName = String(body.legalName || body.fullName || actor.display_name || "").trim();
    if (!legalName) return json(req, res, 400, { error: "Enter your name or business legal name" });
    if (!pan) return json(req, res, 400, { error: "Enter your PAN number" });
    if (!docNumber) return json(req, res, 400, { error: "Enter your citizenship or passport number" });
    const prefix = docType === "passport" ? "passport" : "citizenship";
    const front = saveKycFile(actor.id, `${prefix}_front`, body.front);
    const back = body.back ? saveKycFile(actor.id, `${prefix}_back`, body.back) : null;
    const address = body.addressProof ? saveKycFile(actor.id, "address", body.addressProof) : null;
    if (!front) return json(req, res, 400, { error: "Upload a clear photo of the front of your ID" });
    if (docType === "citizenship" && !back) {
      return json(req, res, 400, { error: "Upload the back of your Nepali citizenship card" });
    }
    const sellerType = body.sellerType === "business" ? "business" : "individual";
    if (sellerType === "business") {
      await (await db()).query(`UPDATE users SET account_type = 'business', updated_at = NOW() WHERE id = $1`, [actor.id]);
    }
    await (await db()).query(
      `INSERT INTO business_profiles (user_id, legal_name, registration_country, tax_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET legal_name = EXCLUDED.legal_name,
           registration_country = COALESCE(EXCLUDED.registration_country, business_profiles.registration_country),
           tax_id = EXCLUDED.tax_id,
           updated_at = NOW()`,
      [actor.id, legalName, actor.country || "Nepal", pan],
    );
    const publicId = randomUUID();
    await (await db()).query(
      `INSERT INTO kyc_documents (public_id, user_id, doc_type, doc_number_encrypted, front_url, back_url, selfie_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
      [publicId, actor.id, docType, encryptDocNumber(docNumber), front, back, address],
    );
    return json(req, res, 201, {
      data: { id: publicId, status: "pending", statusLabel: "Pending Review" },
    });
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
      `SELECT a.public_id, a.message, a.status, a.resolution, a.created_at, a.evidence_url, c.action, c.reason
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
    const action = await latestAction(actor.id);
    const canAppeal =
      actor.status === "restricted" || actor.status === "suspended" || action?.action === "warn";
    if (!canAppeal) return json(req, res, 400, { error: "This account is not restricted" });
    const { rows: actions } = await (await db()).query(
      `SELECT id FROM account_actions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [actor.id],
    );
    const evidence = body.evidence ? saveAppealFile(actor.id, body.evidence) : null;
    await (await db()).query(
      `INSERT INTO appeals (public_id, user_id, action_id, message, evidence_url) VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), actor.id, actions[0]?.id ?? null, message, evidence],
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
      `SELECT k.public_id, k.doc_type, k.status, k.rejection_reason, k.created_at, k.reviewed_at,
              k.front_url, k.back_url, k.selfie_url,
              u.email, u.public_id AS user_id, u.is_seller,
              p.display_name, p.first_name, p.last_name, b.tax_id
       FROM kyc_documents k
       JOIN users u ON u.id = k.user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN business_profiles b ON b.user_id = u.id
       ORDER BY (k.status = 'pending') DESC, k.created_at DESC LIMIT 50`,
    );
    return json(req, res, 200, { data: rows.map(presentAdminKyc) });
  }

  const kycDecision = pathname.match(new RegExp(`^${API}/admin/kyc/([^/]+)$`));
  if (kycDecision && method === "GET") {
    const { rows } = await (await db()).query(
      `SELECT k.public_id, k.doc_type, k.status, k.rejection_reason, k.created_at, k.reviewed_at,
              k.front_url, k.back_url, k.selfie_url,
              u.email, u.public_id AS user_id, u.is_seller,
              p.display_name, p.first_name, p.last_name, b.tax_id
       FROM kyc_documents k
       JOIN users u ON u.id = k.user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN business_profiles b ON b.user_id = u.id
       WHERE k.public_id = $1`,
      [kycDecision[1]],
    );
    if (!rows[0]) return json(req, res, 404, { error: "KYC application not found" });
    return json(req, res, 200, { data: presentAdminKyc(rows[0]) });
  }
  if (kycDecision && method === "POST") {
    const body = await readJson(req);
    const decision = body.decision === "approved" ? "approved" : "rejected";
    if (decision === "rejected" && !String(body.reason ?? "").trim()) {
      return json(req, res, 400, { error: "A rejection needs a reason" });
    }
    const { rows } = await (await db()).query(
      `UPDATE kyc_documents
       SET status = $2, rejection_reason = $3, reviewed_by = $4, reviewed_at = NOW()
       WHERE public_id = $1
       RETURNING user_id`,
      [kycDecision[1], decision, decision === "rejected" ? body.reason : null, actor.id],
    );
    if (!rows[0]) return json(req, res, 404, { error: "KYC application not found" });
    if (decision === "approved") await enableSeller(rows[0].user_id);
    return json(req, res, 200, {
      data: {
        status: decision,
        statusLabel: kycStatusLabel(decision),
        isSeller: decision === "approved",
      },
    });
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
    const action = ["warn", "restrict", "suspend", "restore"].includes(body.action) ? body.action : null;
    const reason = String(body.reason ?? "").trim();
    if (!action || reason.length < 3) return json(req, res, 400, { error: "Choose an action and a reason" });
    const target = await findUser(body.userId);
    if (!target) return json(req, res, 404, { error: "User not found" });
    const status =
      action === "restore" ? "active" : action === "suspend" ? "suspended" : action === "restrict" ? "restricted" : "active";
    await (await db()).query(`UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1`, [target.id, status]);
    await (await db()).query(
      `INSERT INTO account_actions (public_id, user_id, action, reason, until_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), target.id, action, reason, body.until || null, actor.id],
    );
    return json(req, res, 200, { data: { status, kind: standingKind(action) || "Restored" } });
  }

  if (pathname === `${API}/admin/appeals` && method === "GET") {
    const { rows } = await (await db()).query(
      `SELECT a.public_id, a.message, a.status, a.evidence_url, a.created_at,
              u.email, u.public_id AS user_id, p.display_name,
              c.action, c.reason, c.until_at
       FROM appeals a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN account_actions c ON c.id = a.action_id
       WHERE a.status = 'pending'
       ORDER BY a.created_at`,
    );
    return json(req, res, 200, {
      data: rows.map((row) => ({
        ...row,
        evidence: row.evidence_url ? `/api/v1/admin/appeals/${row.public_id}/file` : null,
        evidence_url: undefined,
        kind: standingKind(row.action),
      })),
    });
  }

  const appealFile = pathname.match(new RegExp(`^${API}/admin/appeals/([^/]+)/file$`));
  if (appealFile && method === "GET") {
    const { rows } = await (await db()).query(
      `SELECT user_id, evidence_url FROM appeals WHERE public_id = $1`,
      [appealFile[1]],
    );
    const doc = rows[0];
    if (!doc?.evidence_url) return json(req, res, 404, { error: "No evidence file" });
    const path = join(appealsDir, String(doc.user_id), doc.evidence_url);
    if (!existsSync(path)) return json(req, res, 404, { error: "No evidence file" });
    const bytes = readFileSync(path);
    const type = doc.evidence_url.endsWith(".png") ? "image/png" : doc.evidence_url.endsWith(".pdf") ? "application/pdf" : "image/jpeg";
    res.writeHead(200, { "Content-Type": type, "Content-Length": bytes.length, "Cache-Control": "private, max-age=60" });
    res.end(bytes);
    return true;
  }

  const appealDecision = pathname.match(new RegExp(`^${API}/admin/appeals/([^/]+)$`));
  if (appealDecision && method === "POST") {
    const body = await readJson(req);
    const lift = body.decision === "overturned" || body.decision === "lift";
    const decision = lift ? "overturned" : "upheld";
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
        [randomUUID(), rows[0].user_id, body.resolution || "Restriction lifted after appeal", actor.id],
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

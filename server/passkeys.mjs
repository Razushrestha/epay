import { createHash, randomBytes } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { query } from "./db.mjs";

let ready;

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function ensurePasskeyTables() {
  if (!ready) {
    ready = createPasskeyTables().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

async function createPasskeyTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS user_passkeys (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credential_id TEXT NOT NULL UNIQUE,
      public_key BYTEA NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0,
      device_type TEXT,
      backed_up BOOLEAN NOT NULL DEFAULT FALSE,
      transports JSONB,
      name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS user_passkeys_user_idx ON user_passkeys(user_id)`);
  await query(`
    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      token_hash TEXT PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      challenge TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export function webauthnConfig(req) {
  const headerOrigin = String(req.headers.origin || "").replace(/\/$/, "");
  const envOrigin = String(process.env.WEBAUTHN_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000")
    .split(",")[0]
    .trim()
    .replace(/:4000$/, ":3000");
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const proto =
    forwardedProto ||
    (forwardedHost.startsWith("localhost") || forwardedHost.startsWith("127.0.0.1") ? "http" : "https");
  const origin = envOrigin || headerOrigin || `${proto}://${forwardedHost}`;
  let rpID = process.env.WEBAUTHN_RP_ID;
  try {
    rpID = rpID || new URL(origin).hostname;
  } catch {
    rpID = "localhost";
  }
  const origins = [...new Set([origin, headerOrigin, envOrigin].filter(Boolean))];
  return { rpName: "Nexlo", rpID, origin, origins };
}

async function saveChallenge(purpose, challenge, userId = null) {
  const token = randomBytes(24).toString("hex");
  await query(
    `INSERT INTO webauthn_challenges (token_hash, user_id, purpose, challenge, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '5 minutes')`,
    [sha256(token), userId, purpose, challenge],
  );
  return token;
}

async function takeChallenge(token, purpose) {
  const hash = sha256(token);
  const { rows } = await query(
    `SELECT user_id, challenge FROM webauthn_challenges
     WHERE token_hash = $1 AND purpose = $2 AND expires_at > NOW()`,
    [hash, purpose],
  );
  await query(`DELETE FROM webauthn_challenges WHERE token_hash = $1`, [hash]);
  return rows[0] || null;
}

async function listCredentialRows(userId) {
  const { rows } = await query(
    `SELECT credential_id, transports FROM user_passkeys WHERE user_id = $1`,
    [userId],
  );
  return rows.map((row) => ({
    id: row.credential_id,
    transports: Array.isArray(row.transports) ? row.transports : undefined,
  }));
}

export async function listPasskeys(userId) {
  await ensurePasskeyTables();
  const { rows } = await query(
    `SELECT id, name, device_type, backed_up, created_at, last_used_at
     FROM user_passkeys WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}

export async function deletePasskey(userId, id) {
  await ensurePasskeyTables();
  const { rowCount } = await query(`DELETE FROM user_passkeys WHERE id = $1 AND user_id = $2`, [id, userId]);
  return rowCount > 0;
}

export async function beginRegistration(req, user) {
  await ensurePasskeyTables();
  const { rpName, rpID } = webauthnConfig(req);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email || user.phone || user.username || `user-${user.id}`,
    userDisplayName: user.display_name || user.email || "Nexlo member",
    userID: new Uint8Array(Buffer.from(String(user.public_id || user.id))),
    attestationType: "none",
    excludeCredentials: await listCredentialRows(user.id),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
  const challengeToken = await saveChallenge("register", options.challenge, user.id);
  return { options, challengeToken };
}

export async function finishRegistration(req, user, body) {
  await ensurePasskeyTables();
  const saved = await takeChallenge(body.challengeToken, "register");
  if (!saved || Number(saved.user_id) !== Number(user.id)) {
    return { ok: false, error: "That passkey challenge expired. Try again." };
  }
  const { origin, origins, rpID } = webauthnConfig(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: saved.challenge,
      expectedOrigin: origins.length ? origins : origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not verify this passkey" };
  }
  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, error: "That passkey could not be verified" };
  }
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const name = String(body.name || "").trim().slice(0, 80) || passkeyLabel(req);
  await query(
    `INSERT INTO user_passkeys (user_id, credential_id, public_key, counter, device_type, backed_up, transports, name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (credential_id) DO NOTHING`,
    [
      user.id,
      credential.id,
      Buffer.from(credential.publicKey),
      credential.counter,
      credentialDeviceType || null,
      Boolean(credentialBackedUp),
      body.response?.response?.transports || credential.transports || [],
      name,
    ],
  );
  return { ok: true };
}

export async function beginAuthentication(req, identifier) {
  await ensurePasskeyTables();
  const { rpID } = webauthnConfig(req);
  let allowCredentials;
  let userId = null;
  if (identifier) {
    const { rows } = await query(
      `SELECT u.id FROM users u
       WHERE u.deleted_at IS NULL AND (lower(u.email) = $1 OR u.phone = $1 OR lower(u.username) = $1)
       LIMIT 1`,
      [String(identifier).trim().toLowerCase()],
    );
    if (rows[0]) {
      userId = rows[0].id;
      allowCredentials = await listCredentialRows(userId);
    }
  }
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: allowCredentials?.length ? allowCredentials : undefined,
  });
  const challengeToken = await saveChallenge("login", options.challenge, userId);
  return { options, challengeToken };
}

export async function finishAuthentication(req, body) {
  await ensurePasskeyTables();
  const saved = await takeChallenge(body.challengeToken, "login");
  if (!saved) return { ok: false, error: "That passkey challenge expired. Try again." };
  const credId = body.response?.id;
  if (!credId) return { ok: false, error: "Passkey response was incomplete" };
  const { rows } = await query(`SELECT * FROM user_passkeys WHERE credential_id = $1`, [credId]);
  const passkey = rows[0];
  if (!passkey) return { ok: false, error: "This passkey is not registered on Nexlo" };
  const { origin, origins, rpID } = webauthnConfig(req);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: saved.challenge,
      expectedOrigin: origins.length ? origins : origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: passkey.credential_id,
        publicKey: new Uint8Array(passkey.public_key),
        counter: Number(passkey.counter || 0),
        transports: Array.isArray(passkey.transports) ? passkey.transports : undefined,
      },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not verify this passkey" };
  }
  if (!verification.verified) return { ok: false, error: "That passkey could not be verified" };
  const newCounter = verification.authenticationInfo?.newCounter ?? Number(passkey.counter || 0);
  await query(`UPDATE user_passkeys SET counter = $1, last_used_at = NOW() WHERE id = $2`, [newCounter, passkey.id]);
  const user = await query(
    `SELECT u.*, p.display_name, p.first_name, p.last_name
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [passkey.user_id],
  );
  if (!user.rows[0]) return { ok: false, error: "Account not found" };
  return { ok: true, user: user.rows[0] };
}

function passkeyLabel(req) {
  const agent = String(req.headers["user-agent"] || "");
  if (/iPhone|iPad|Macintosh/i.test(agent)) return "Apple Passkey";
  if (/Android/i.test(agent)) return "Android passkey";
  if (/Windows/i.test(agent)) return "Windows Hello";
  return "This device";
}

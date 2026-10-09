import { query } from "./db.mjs";
import { notify } from "./notify.mjs";
import { audit } from "./rbac.mjs";

const BANNED = /\b(weapon|firearm|ammunition|drug|narcotic|counterfeit|fake\s+id|stolen|explosive|child\s*porn)\b/i;

export function protectionOpen(deliveredAt, days = 30) {
  if (!deliveredAt) return false;
  const end = new Date(deliveredAt).getTime() + Number(days) * 86400000;
  return Date.now() <= end;
}

export function strikeAction(count) {
  if (count >= 4) return "ban";
  if (count >= 3) return "restrict";
  if (count >= 1) return "warn";
  return "none";
}

export function scoreRisk(events) {
  return events.reduce((sum, ev) => sum + Number(ev.score || 0), 0);
}

export function scanContent(text) {
  const value = String(text || "");
  if (BANNED.test(value)) return { flagged: true, score: 50, reason: "prohibited_content" };
  return { flagged: false, score: 0, reason: null };
}

async function addRisk(userId, eventType, score, details) {
  await query(
    `INSERT INTO risk_events (user_id, event_type, score, details) VALUES ($1,$2,$3,$4)`,
    [userId, eventType, score, JSON.stringify(details || {})],
  );
  await query(`UPDATE users SET risk_score = LEAST(100, risk_score + $2) WHERE id = $1`, [userId, score]);
}

export async function recordDevice(userId, deviceHash) {
  if (!userId || !deviceHash) return;
  await query(
    `INSERT INTO device_fingerprints (user_id, device_hash) VALUES ($1,$2)
     ON CONFLICT (user_id, device_hash) DO UPDATE SET last_seen = NOW()`,
    [userId, String(deviceHash).slice(0, 128)],
  );
}

export async function evaluateUser(userId, context = {}) {
  const hits = [];
  const ip = context.ip || null;
  const email = context.email || null;
  const phone = context.phone || null;

  if (email || phone || ip) {
    const { rows } = await query(
      `SELECT kind, value FROM blacklists WHERE (kind = 'email' AND value = $1)
         OR (kind = 'phone' AND value = $2) OR (kind = 'ip' AND value = $3)`,
      [email || "", phone || "", ip || ""],
    );
    if (rows[0]) {
      hits.push({ name: "blacklist_hit", score: 100, action: "block" });
      await addRisk(userId, "blacklist_hit", 100, rows[0]);
    }
  }

  if (context.kind === "register" && ip) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS c FROM risk_events
       WHERE event_type = 'register' AND details->>'ip' = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [ip],
    );
    if (Number(rows[0]?.c || 0) >= 3) {
      hits.push({ name: "register_velocity", score: 25, action: "review" });
      await addRisk(userId, "register_velocity", 25, { ip });
    }
    await addRisk(userId, "register", 1, { ip });
  }

  if (context.kind === "listing") {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS c FROM listings WHERE seller_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [userId],
    );
    if (Number(rows[0]?.c || 0) >= 8) {
      hits.push({ name: "listing_velocity", score: 20, action: "review" });
      await addRisk(userId, "listing_velocity", 20, { count: rows[0].c });
    }
    const scan = scanContent(`${context.title || ""} ${context.description || ""}`);
    if (scan.flagged) {
      hits.push({ name: "prohibited_content", score: scan.score, action: "flag" });
      await addRisk(userId, "prohibited_content", scan.score, { title: context.title });
    }
  }

  if (context.kind === "bid") {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS c FROM bids WHERE bidder_id = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
      [userId],
    );
    if (Number(rows[0]?.c || 0) >= 20) {
      hits.push({ name: "bid_velocity", score: 30, action: "review" });
      await addRisk(userId, "bid_velocity", 30, { count: rows[0].c });
    }
  }

  const blocked = hits.some((h) => h.action === "block");
  const flagged = hits.some((h) => h.action === "flag" || h.action === "review");
  return { hits, score: scoreRisk(hits), blocked, flagged };
}

export async function enforceVerification(userId) {
  const { rows } = await query(
    `SELECT email_verified_at, phone_verified_at, status FROM users WHERE id = $1`,
    [userId],
  );
  const user = rows[0];
  if (!user) return { status: 401, body: { error: "Sign in required" } };
  if (user.status !== "active") return { status: 403, body: { error: "This account cannot list items right now" } };
  if (!user.email_verified_at && !user.phone_verified_at) {
    return { status: 403, body: { error: "Verify your email or phone before listing or bidding" } };
  }
  return null;
}

export async function applyStrike(userId, kind, reason, actor) {
  await query(`INSERT INTO strikes (user_id, kind, reason, expires_at) VALUES ($1,$2,$3, NOW() + INTERVAL '90 days')`, [
    userId,
    kind || "policy",
    reason,
  ]);
  const { rows } = await query(`SELECT COUNT(*)::int AS c FROM strikes WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`, [userId]);
  const count = Number(rows[0]?.c || 0);
  if (kind === "unpaid") {
    await query(`UPDATE users SET unpaid_strikes = $2 WHERE id = $1`, [userId, count]);
  }
  const action = strikeAction(count);
  if (action === "restrict") {
    await query(`UPDATE users SET status = 'restricted' WHERE id = $1 AND status = 'active'`, [userId]);
  }
  if (action === "ban") {
    await query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [userId]);
  }
  await notify(userId, "strike", "Account warning", `${reason} (${count} active strike${count === 1 ? "" : "s"}).`, "/account?tab=activity");
  if (actor) await audit(actor, "strike.create", "user", userId, { kind, reason, action, count });
  return { count, action };
}

export async function handleTrust(method, pathParts, auth, body) {
  if (pathParts[0] === "reports" && method === "POST") {
    if (!auth) return { status: 401, body: { error: "Sign in required" } };
    const targetType = ["user", "listing", "message"].includes(body.targetType) ? body.targetType : null;
    if (!targetType || !body.targetId || !body.reason) return { status: 400, body: { error: "Target and reason required" } };
    await query(
      `INSERT INTO user_reports (reporter_id, target_type, target_id, reason, detail) VALUES ($1,$2,$3,$4,$5)`,
      [auth.user_id, targetType, String(body.targetId), String(body.reason).slice(0, 80), String(body.detail || "").slice(0, 1000)],
    );
    await query(
      `INSERT INTO moderation_queue (item_type, item_id, reason, score) VALUES ($1,$2,$3,15)`,
      [targetType, String(body.targetId), body.reason],
    );
    return { status: 201, body: { data: { reported: true } } };
  }

  if (pathParts[0] !== "admin") return null;
  if (pathParts[1] === "trust" && method === "GET") {
    const events = await query(
      `SELECT r.*, u.email, u.public_id FROM risk_events r
       LEFT JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC LIMIT 80`,
    );
    const lists = await query(`SELECT * FROM blacklists ORDER BY created_at DESC LIMIT 80`);
    const strikeRows = await query(
      `SELECT s.*, u.email FROM strikes s JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC LIMIT 80`,
    );
    const reports = await query(`SELECT * FROM user_reports ORDER BY created_at DESC LIMIT 80`);
    return { status: 200, body: { events: events.rows, blacklists: lists.rows, strikes: strikeRows.rows, reports: reports.rows } };
  }
  if (pathParts[1] === "trust" && pathParts[2] === "blacklist" && method === "POST") {
    if (!["email", "phone", "ip", "device"].includes(body.kind) || !body.value) {
      return { status: 400, body: { error: "Kind and value required" } };
    }
    await query(
      `INSERT INTO blacklists (kind, value, reason) VALUES ($1,$2,$3) ON CONFLICT (kind, value) DO UPDATE SET reason = EXCLUDED.reason`,
      [body.kind, String(body.value).toLowerCase(), body.reason || "Staff block"],
    );
    await audit(auth, "blacklist.add", "blacklist", body.value, body);
    return { status: 201, body: { data: { saved: true } } };
  }
  if (pathParts[1] === "strikes" && method === "POST") {
    const user = await query(`SELECT id FROM users WHERE public_id::text = $1 OR id::text = $1`, [String(body.userId)]);
    if (!user.rows[0]) return { status: 404, body: { error: "User not found" } };
    const result = await applyStrike(user.rows[0].id, body.kind || "policy", body.reason || "Staff strike", auth);
    return { status: 201, body: { data: result } };
  }
  return null;
}

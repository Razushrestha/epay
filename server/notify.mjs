import { query } from "./db.mjs";
import { sendTransactional } from "./mail.mjs";
import { sendSms } from "./sms.mjs";
import { inQuietHours } from "./commerce-rules.mjs";

const SPAM = /(whatsapp|viber|telegram|\b\d{10}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;

export function looksLikeSpam(text) {
  return SPAM.test(String(text || ""));
}

async function templateFor(type, title, body) {
  try {
    const { rows } = await query(`SELECT email_subject, email_body FROM notification_templates WHERE type = $1`, [type]);
    if (rows[0]) {
      return {
        title: rows[0].email_subject.replace(/\{\{title\}\}/g, title),
        body: rows[0].email_body.replace(/\{\{body\}\}/g, body || "").replace(/\{\{title\}\}/g, title),
      };
    }
  } catch {
    /* templates optional */
  }
  return { title, body };
}

export async function notify(userId, type, title, body, href) {
  if (!userId) return;
  let prefs = { email_enabled: true, sms_enabled: false, in_app_enabled: true, quiet_hours: null };
  try {
    const { rows } = await query(`SELECT * FROM notification_preferences WHERE user_id = $1`, [userId]);
    if (rows[0]) prefs = rows[0];
  } catch {
    /* table may not exist yet */
  }
  const rendered = await templateFor(type, title, body);
  const quiet = inQuietHours(prefs.quiet_hours);
  if (prefs.in_app_enabled !== false) {
    await query(
      `INSERT INTO notifications (user_id, type, title, body, href) VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, rendered.title, rendered.body ?? "", href ?? null],
    );
  }
  if (prefs.email_enabled !== false && !quiet) {
    try {
      const user = await query(`SELECT email FROM users WHERE id = $1`, [userId]);
      const email = user.rows[0]?.email;
      if (email) {
        await sendNotice(email, rendered.title, rendered.body);
      }
    } catch (err) {
      console.warn("[notify] email failed", err.message);
    }
  }
  if (prefs.sms_enabled && !quiet) {
    try {
      const user = await query(`SELECT phone FROM users WHERE id = $1`, [userId]);
      if (user.rows[0]?.phone) await sendSms(user.rows[0].phone, `${rendered.title}: ${rendered.body || ""}`.slice(0, 160));
    } catch (err) {
      console.warn("[notify] sms failed", err.message);
    }
  }
}

async function sendNotice(to, title, body) {
  await sendTransactional({ to, subject: `Nexlo: ${title}`, text: body || title });
}

export async function handleNotify(method, pathParts, auth, body, searchParams) {
  if (pathParts[0] !== "notifications") return null;
  if (!auth) return { status: 401, body: { error: "Sign in required" } };
  if (method === "GET" && pathParts[0] === "notifications" && !pathParts[1]) {
    const { rows } = await query(
      `SELECT id, type, title, body, href, read_at, created_at
       FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 40`,
      [auth.user_id],
    );
    const unread = rows.filter((r) => !r.read_at).length;
    return { status: 200, body: { data: rows, unread } };
  }
  if (method === "POST" && pathParts[0] === "notifications" && pathParts[1] === "read") {
    await query(`UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`, [auth.user_id]);
    return { status: 200, body: { data: { ok: true } } };
  }
  if (method === "GET" && pathParts[0] === "notifications" && pathParts[1] === "preferences") {
    const { rows } = await query(`SELECT * FROM notification_preferences WHERE user_id = $1`, [auth.user_id]);
    return { status: 200, body: { data: rows[0] || { email_enabled: true, sms_enabled: false, in_app_enabled: true } } };
  }
  if (method === "PATCH" && pathParts[0] === "notifications" && pathParts[1] === "preferences") {
    await query(
      `INSERT INTO notification_preferences (user_id, email_enabled, sms_enabled, in_app_enabled, quiet_hours)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET email_enabled = EXCLUDED.email_enabled, sms_enabled = EXCLUDED.sms_enabled, in_app_enabled = EXCLUDED.in_app_enabled, quiet_hours = EXCLUDED.quiet_hours`,
      [auth.user_id, body.email !== false, Boolean(body.sms), body.inApp !== false, body.quietHours || body.quiet_hours || null],
    );
    return { status: 200, body: { data: { saved: true } } };
  }
  return null;
}

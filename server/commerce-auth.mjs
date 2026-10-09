import { createHash } from "node:crypto";
import { query } from "./db.mjs";

export async function authFromHeaders(headers) {
  const token = String(headers.authorization ?? headers.Authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const { rows } = await query(
    `SELECT u.id as user_id, u.public_id, u.email, u.phone, u.is_seller, u.is_staff, u.staff_role, u.status, u.seller_level, u.email_verified_at, u.phone_verified_at
     FROM auth_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW() AND u.deleted_at IS NULL`,
    [hash],
  );
  return rows[0] || null;
}

export function incrementFor(price) {
  const n = Number(price) || 0;
  if (n < 1000) return 50;
  if (n < 5000) return 100;
  if (n < 10000) return 250;
  if (n < 25000) return 500;
  if (n < 100000) return 1000;
  return 2500;
}

export async function nextOrderNumber() {
  const year = new Date().getFullYear();
  const { rows } = await query(`SELECT COUNT(*)::int AS c FROM orders WHERE order_number LIKE $1`, [`ORD-${year}-%`]);
  return `ORD-${year}-${String((rows[0]?.c || 0) + 1).padStart(6, "0")}`;
}

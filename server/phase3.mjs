import { randomUUID } from "node:crypto";
import { authFromHeaders } from "./commerce-auth.mjs";
import { handleAuctions } from "./auctions.mjs";
import { handleOffers } from "./offers.mjs";
import { handleFulfillment } from "./fulfillment.mjs";
import { handleLedger } from "./ledger.mjs";
import { handleInbox } from "./inbox.mjs";
import { handleNotify } from "./notify.mjs";
import { query } from "./db.mjs";

const PHASE3_ROOTS = new Set([
  "auctions",
  "offers",
  "orders",
  "wallet",
  "messages",
  "conversations",
  "notifications",
  "feedback",
]);

export function isPhase3Path(pathParts) {
  if (PHASE3_ROOTS.has(pathParts[0])) return true;
  if (pathParts[0] === "admin" && ["payouts", "refunds", "ledger"].includes(pathParts[1])) return true;
  return false;
}

export async function handlePhase3(req, method, pathParts, body) {
  const auth = await authFromHeaders(req.headers);

  if (pathParts[0] === "feedback" && method === "POST" && pathParts[1] && pathParts[2] === "reply") {
    if (!auth) return { status: 401, body: { error: "Sign in required" } };
    const { rows } = await query(
      `SELECT * FROM feedback WHERE (id::text = $1 OR public_id::text = $1) AND seller_id = $2`,
      [pathParts[1], auth.user_id],
    );
    if (!rows[0]) return { status: 404, body: { error: "Feedback not found" } };
    await query(`UPDATE feedback SET reply = $2, reply_at = NOW() WHERE id = $1`, [rows[0].id, String(body.reply || "").slice(0, 500)]);
    return { status: 200, body: { data: { replied: true } } };
  }

  if (pathParts[0] === "feedback" && method === "POST" && !pathParts[1]) {
    if (!auth) return { status: 401, body: { error: "Sign in required" } };
    const orderId = body.orderId;
    const stars = Number(body.rating);
    if (!orderId || !(stars >= 1 && stars <= 5)) return { status: 400, body: { error: "Order and 1–5 rating required" } };
    const order = await query(
      `SELECT o.id, o.buyer_id, oi.seller_id FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id::text = $1 OR o.order_number = $1
       LIMIT 1`,
      [String(orderId)],
    );
    const row = order.rows[0];
    if (!row) return { status: 404, body: { error: "Order not found" } };
    const isBuyer = Number(row.buyer_id) === Number(auth.user_id);
    const isSeller = Number(row.seller_id) === Number(auth.user_id);
    if (!isBuyer && !isSeller) return { status: 403, body: { error: "Not your order" } };
    const direction = isBuyer ? "buyer_to_seller" : "seller_to_buyer";
    const label = stars >= 4 ? "positive" : stars === 3 ? "neutral" : "negative";
    try {
      await query(
        `INSERT INTO feedback (
           public_id, seller_id, buyer_id, rating, comment, order_id, direction,
           item_as_described, communication, shipping_time, shipping_cost
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          randomUUID(),
          row.seller_id,
          row.buyer_id,
          label,
          String(body.comment || "").trim() || null,
          row.id,
          direction,
          isBuyer ? Number(body.dsrItem || stars) : null,
          isBuyer ? Number(body.dsrCommunication || stars) : null,
          isBuyer ? Number(body.dsrShipping || stars) : null,
          isBuyer ? Number(body.dsrShippingCost || stars) : null,
        ],
      );
    } catch (err) {
      if (String(err.message).includes("unique") || String(err.code) === "23505") {
        return { status: 409, body: { error: "Feedback already left for this order" } };
      }
      throw err;
    }
    const target = isBuyer ? row.seller_id : row.buyer_id;
    const counts = await query(
      `SELECT
         COUNT(*) FILTER (WHERE rating = 'positive') AS positive_count,
         COUNT(*) FILTER (WHERE rating = 'neutral') AS neutral_count,
         COUNT(*) FILTER (WHERE rating = 'negative') AS negative_count
       FROM feedback WHERE seller_id = $1 OR (direction = 'seller_to_buyer' AND buyer_id = $1)`,
      [target],
    );
    const c = counts.rows[0];
    await query(
      `INSERT INTO feedback_scores (user_id, positive_count, neutral_count, negative_count)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET
         positive_count = EXCLUDED.positive_count,
         neutral_count = EXCLUDED.neutral_count,
         negative_count = EXCLUDED.negative_count`,
      [target, c.positive_count, c.neutral_count, c.negative_count],
    );
    return { status: 201, body: { data: { saved: true, rating: label } } };
  }

  const handlers = [handleAuctions, handleOffers, handleFulfillment, handleLedger, handleInbox, handleNotify];
  for (const fn of handlers) {
    const result = await fn(method, pathParts, auth, body);
    if (result) return result;
  }
  return null;
}

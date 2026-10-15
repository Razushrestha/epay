import { query } from "./db.mjs";

export function maskBidder(name) {
  const value = String(name || "Bidder").trim();
  if (value.length <= 2) return `${value[0] || "B"}***`;
  return `${value[0]}***${value.slice(-1)}`;
}

export function publicBids(rows) {
  return (rows || []).map((row) => ({
    amount: row.amount,
    created_at: row.created_at,
    bidder: maskBidder(row.bidder),
  }));
}

export async function sellerDsr(sellerId) {
  try {
    const { rows } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE item_as_described IS NOT NULL)::int AS count,
         ROUND(AVG(item_as_described)::numeric, 1) AS item,
         ROUND(AVG(communication)::numeric, 1) AS communication,
         ROUND(AVG(shipping_time)::numeric, 1) AS shipping_time,
         ROUND(AVG(shipping_cost)::numeric, 1) AS shipping_cost
       FROM feedback
       WHERE seller_id = $1 AND direction = 'buyer_to_seller'`,
      [sellerId],
    );
    const row = rows[0] || {};
    return {
      count: Number(row.count || 0),
      item: row.item != null ? Number(row.item) : null,
      communication: row.communication != null ? Number(row.communication) : null,
      shipping_time: row.shipping_time != null ? Number(row.shipping_time) : null,
      shipping_cost: row.shipping_cost != null ? Number(row.shipping_cost) : null,
    };
  } catch {
    return { count: 0, item: null, communication: null, shipping_time: null, shipping_cost: null };
  }
}

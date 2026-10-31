import { query } from "./db.mjs";

export const RESERVED_MESSAGE = "Item reserved by another buyer";
export const RESERVE_MINUTES = 15;

export function reservedError() {
  return { status: 409, body: { error: RESERVED_MESSAGE, reserved: true, available: 0 } };
}

export async function purgeExpiredReservations(client) {
  const run = client ? client.query.bind(client) : query;
  await run(
    `UPDATE stock_reservations
     SET released_at = NOW()
     WHERE expires_at <= NOW() AND released_at IS NULL`,
  );
}

export async function expireReservations() {
  const expired = await query(
    `UPDATE stock_reservations
     SET released_at = COALESCE(released_at, NOW())
     WHERE expires_at <= NOW()
     RETURNING id, listing_id, quantity, reserved_by_user_id`,
  );
  const deleted = await query(
    `DELETE FROM stock_reservations
     WHERE expires_at <= NOW()
     RETURNING id, listing_id`,
  );
  return {
    expired: expired.rows,
    deleted: deleted.rowCount,
  };
}

export async function reservationState(listingId, variationSkuId = null, userId = null, client = null) {
  const run = client ? client.query.bind(client) : query;
  await purgeExpiredReservations(client);

  let stock = 0;
  if (variationSkuId) {
    const sku = await run(
      `SELECT quantity AS stock FROM listing_variation_skus WHERE id = $1 AND listing_id = $2`,
      [variationSkuId, listingId],
    );
    stock = sku.rows[0] ? Number(sku.rows[0].stock) : 0;
  } else {
    const listing = await run(`SELECT quantity AS stock FROM listings WHERE id = $1`, [listingId]);
    stock = listing.rows[0] ? Number(listing.rows[0].stock) : 0;
  }

  const held = await run(
    `SELECT COALESCE(SUM(quantity), 0)::int AS reserved, MIN(expires_at) AS reserved_until
     FROM stock_reservations
     WHERE listing_id = $1
       AND released_at IS NULL
       AND expires_at > NOW()
       AND variation_sku_id IS NOT DISTINCT FROM $2
       AND ($3::int IS NULL OR reserved_by_user_id IS DISTINCT FROM $3)`,
    [listingId, variationSkuId, userId],
  );

  const reserved = Number(held.rows[0]?.reserved || 0);
  const available = Math.max(0, stock - reserved);
  return {
    stock,
    reserved,
    available,
    reserved_until: held.rows[0]?.reserved_until || null,
    temporarily_unavailable: stock > 0 && available < 1,
  };
}

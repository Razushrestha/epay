import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";

const { createOrder } = await import("./cart.mjs");
const { query, initDb } = await import("./db.mjs");

test("multi-seller checkout creates two orders linked by one session", async () => {
  await initDb();
  await query(`DELETE FROM cart_items WHERE user_id = 145`);
  const listings = await query(
    `SELECT id, seller_id, price FROM listings WHERE id IN (21, 63)`,
  );
  assert.equal(listings.rows.length, 2);
  const sellers = new Set(listings.rows.map((row) => Number(row.seller_id)));
  assert.equal(sellers.size, 2);

  for (const row of listings.rows) {
    await query(
      `INSERT INTO cart_items (user_id, listing_id, quantity, price_snapshot)
       VALUES (145, $1, 1, $2)`,
      [row.id, row.price],
    );
  }

  const result = await createOrder(
    { shipping_address_id: "25bc216d-05eb-438a-ab74-3999d8a3ee1d", donate: false },
    145,
    "pay006-session",
  );
  assert.equal(result.status, 201, result.body?.error);
  assert.equal(result.body.order_ids.length, 2);
  assert.ok(result.body.checkout_session_id);

  const orders = await query(
    `SELECT id, seller_id, checkout_session_id, status, total_amount
     FROM orders WHERE checkout_session_id = $1 ORDER BY seller_id`,
    [result.body.checkout_session_id],
  );
  assert.equal(orders.rows.length, 2);
  assert.equal(Number(orders.rows[0].seller_id), 16);
  assert.equal(Number(orders.rows[1].seller_id), 143);
  assert.equal(orders.rows[0].checkout_session_id, orders.rows[1].checkout_session_id);
  assert.equal(orders.rows[0].status, "pending_payment");
  assert.equal(orders.rows[1].status, "pending_payment");

  const session = await query(`SELECT total_amount FROM checkout_sessions WHERE id = $1`, [
    result.body.checkout_session_id,
  ]);
  const sum = orders.rows.reduce((n, row) => n + Number(row.total_amount), 0);
  assert.equal(Number(session.rows[0].total_amount).toFixed(2), Number(result.body.total).toFixed(2));
  assert.equal(sum.toFixed(2), Number(result.body.total).toFixed(2));
});

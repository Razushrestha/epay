import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

const { handleWebhook } = await import("./payments.mjs");
const { query, initDb } = await import("./db.mjs");

function sign(payload) {
  const secret = process.env.KHALTI_WEBHOOK_SECRET || process.env.KHALTI_SECRET_KEY || "live_secret_key_68791341fdd94846a146f0457ff7b455";
  return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

test("signed webhook completes payment and replay is ignored", async () => {
  await initDb();
  const orderNumber = `ORD-W7${String(Date.now()).slice(-8)}`.slice(0, 20);
  const order = await query(
    `INSERT INTO orders (buyer_id, order_number, status, subtotal, shipping_amount, tax_amount, total_amount, shipping_name, donation_amount)
     VALUES (145, $1, 'pending_payment', 1500, 200, 221, 1921, 'Blurry Docs', 0)
     RETURNING id`,
    [orderNumber],
  );
  const payment = await query(
    `INSERT INTO payments (order_id, gateway, amount, status)
     VALUES ($1, 'khalti', 1921, 'pending')
     RETURNING id`,
    [order.rows[0].id],
  );
  const paymentId = payment.rows[0].id;
  const payload = {
    event_type: "payment",
    pidx: "webhookPidxQA",
    transaction_id: `WH-${paymentId}-${Date.now()}`,
    status: "Completed",
    amount: 192100,
    purchase_order_id: `${orderNumber}-${paymentId}`,
  };
  const headers = { "x-khalti-signature": sign(payload) };

  const first = await handleWebhook("khalti", payload, headers);
  assert.equal(first.status, 200);
  assert.equal(first.body.replayed, false);
  const paid = await query("SELECT status, gateway_transaction_id FROM payments WHERE id = $1", [paymentId]);
  assert.equal(paid.rows[0].status, "completed");
  assert.equal(paid.rows[0].gateway_transaction_id, payload.transaction_id);
  const orderRow = await query("SELECT status FROM orders WHERE order_number = $1", [orderNumber]);
  assert.equal(orderRow.rows[0].status, "paid");

  const ledgerBefore = await query(
    `SELECT COUNT(*)::int AS n FROM ledger_transactions WHERE ref_type = 'order' AND ref_id = $1`,
    [String(order.rows[0].id)],
  );
  const second = await handleWebhook("khalti", payload, headers);
  assert.equal(second.status, 200);
  assert.equal(second.body.replayed, true);
  assert.match(second.body.message, /already processed/i);
  const ledgerAfter = await query(
    `SELECT COUNT(*)::int AS n FROM ledger_transactions WHERE ref_type = 'order' AND ref_id = $1`,
    [String(order.rows[0].id)],
  );
  assert.equal(ledgerAfter.rows[0].n, ledgerBefore.rows[0].n);

  const unsigned = await handleWebhook("khalti", payload, {});
  assert.equal(unsigned.status, 401);
});

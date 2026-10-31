import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";

const khaltiCalls = [];
let lookupStatus = "Completed";

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  khaltiCalls.push({ url, method: init.method || "GET", body: init.body || null });
  return {
    ok: true,
    text: async () =>
      JSON.stringify({
        pidx: "lookupPidxQA",
        status: lookupStatus,
        transaction_id: lookupStatus === "Completed" ? "LOOKUPTXN001" : null,
        total_amount: 192100,
        fee: 0,
        refunded: false,
      }),
  };
};

const { confirmKhaltiLookup, verifyKhaltiPayment } = await import("./payments.mjs");
const { query, initDb } = await import("./db.mjs");

async function seedPending(suffix) {
  const orderNumber = `ORD-L5${suffix}`.slice(0, 20);
  const order = await query(
    `INSERT INTO orders (buyer_id, order_number, status, subtotal, shipping_amount, tax_amount, total_amount, shipping_name, shipping_phone, donation_amount)
     VALUES (145, $1, 'pending_payment', 1500, 200, 221, 1921, 'Blurry Docs', '9800000000', 0)
     RETURNING id, order_number`,
    [orderNumber],
  );
  const payment = await query(
    `INSERT INTO payments (order_id, gateway, amount, status, gateway_response)
     VALUES ($1, 'khalti', 1921, 'pending', $2)
     RETURNING id`,
    [order.rows[0].id, JSON.stringify({ pidx: "lookupPidxQA" })],
  );
  return { orderNumber: order.rows[0].order_number, paymentId: payment.rows[0].id };
}

test("lookup POSTs {pidx} to khalti.com and Completed marks payment completed", async () => {
  await initDb();
  lookupStatus = "Completed";
  khaltiCalls.length = 0;
  const seeded = await seedPending(String(Date.now()).slice(-8));

  const verified = await verifyKhaltiPayment("lookupPidxQA");
  assert.equal(khaltiCalls[0].url, "https://khalti.com/api/v2/epayment/lookup/");
  assert.equal(khaltiCalls[0].method, "POST");
  assert.deepEqual(JSON.parse(khaltiCalls[0].body), { pidx: "lookupPidxQA" });
  assert.equal(verified.ok, true);
  assert.equal(verified.status, "Completed");

  const confirmed = await confirmKhaltiLookup("lookupPidxQA");
  assert.equal(confirmed.verified, true);
  assert.equal(confirmed.payment_id, seeded.paymentId);

  const payment = await query("SELECT status, gateway_transaction_id FROM payments WHERE id = $1", [seeded.paymentId]);
  assert.equal(payment.rows[0].status, "completed");
  assert.equal(payment.rows[0].gateway_transaction_id, "LOOKUPTXN001");

  const order = await query("SELECT status FROM orders WHERE order_number = $1", [seeded.orderNumber]);
  assert.equal(order.rows[0].status, "paid");
});

test("lookup Pending does not complete the payment", async () => {
  await initDb();
  lookupStatus = "Pending";
  khaltiCalls.length = 0;
  const seeded = await seedPending(`P${String(Date.now()).slice(-7)}`);

  const confirmed = await confirmKhaltiLookup("lookupPidxQA");
  assert.equal(khaltiCalls[0].url, "https://khalti.com/api/v2/epayment/lookup/");
  assert.deepEqual(JSON.parse(khaltiCalls[0].body), { pidx: "lookupPidxQA" });
  assert.equal(confirmed.verified, false);
  assert.equal(confirmed.status, "Pending");

  const payment = await query("SELECT status FROM payments WHERE id = $1", [seeded.paymentId]);
  assert.equal(payment.rows[0].status, "pending");

  const order = await query("SELECT status FROM orders WHERE order_number = $1", [seeded.orderNumber]);
  assert.equal(order.rows[0].status, "pending_payment");
});

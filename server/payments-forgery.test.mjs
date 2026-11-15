import "./test-db-guard.mjs";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Replays of the attacks the payment callbacks must reject:
 * paying a tiny amount (or someone else's payment) and claiming it settles an expensive order.
 */
const runId = Date.now();
const calls = [];
let khaltiLookup = {};
let esewaResponse = "<response><response_code>Success</response_code></response>";

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  calls.push({ url: String(url), method: init.method || "GET", body: init.body || null });
  if (String(url).includes("/epayment/lookup/")) {
    return { ok: true, text: async () => JSON.stringify(khaltiLookup) };
  }
  return { ok: true, text: async () => esewaResponse };
};

const { confirmKhaltiLookup, handleEsewaCallback } = await import("./payments.mjs");
const { query, initDb } = await import("./db.mjs");

let counter = 0;
async function seed(gateway, amount, gatewayResponse = null) {
  counter += 1;
  const orderNumber = `ORD-F${String(runId).slice(-7)}${counter}`.slice(0, 20);
  const tax = Math.round(amount * 0.13);
  const order = await query(
    `INSERT INTO orders (buyer_id, order_number, status, subtotal, shipping_amount, tax_amount, total_amount, shipping_name, shipping_phone, donation_amount)
     VALUES (145, $1, 'pending_payment', $2, 0, $3, $4, 'Forgery Test', '9800000000', 0)
     RETURNING id`,
    [orderNumber, amount - tax, tax, amount],
  );
  const payment = await query(
    `INSERT INTO payments (order_id, gateway, amount, status, gateway_response)
     VALUES ($1, $2, $3, 'pending', $4) RETURNING id`,
    [order.rows[0].id, gateway, amount, gatewayResponse ? JSON.stringify(gatewayResponse) : null],
  );
  return { orderNumber, orderId: order.rows[0].id, paymentId: payment.rows[0].id };
}
const orderStatus = async (orderNumber) =>
  (await query(`SELECT status FROM orders WHERE order_number = $1`, [orderNumber])).rows[0].status;

test("Khalti: a pidx we never issued cannot mark anything paid", async () => {
  await initDb();
  const victim = await seed("khalti", 5000, { pidx: `real-${runId}-a` });
  khaltiLookup = { status: "Completed", transaction_id: `T-${runId}-a`, total_amount: 500000 };
  // Attacker's own (sandbox/other) payment pidx, aimed at the victim order number.
  const result = await confirmKhaltiLookup(`attacker-${runId}`, `${victim.orderNumber}-${victim.paymentId}`);
  assert.equal(result.verified, false);
  assert.equal(await orderStatus(victim.orderNumber), "pending_payment");
});

test("Khalti: a Completed payment for the wrong amount is rejected", async () => {
  await initDb();
  const order = await seed("khalti", 5000, { pidx: `real-${runId}-b` });
  khaltiLookup = { status: "Completed", transaction_id: `T-${runId}-b`, total_amount: 100 }; // paid 1 NPR
  const result = await confirmKhaltiLookup(`real-${runId}-b`);
  assert.equal(result.verified, false);
  assert.equal(await orderStatus(order.orderNumber), "pending_payment");
  const row = (await query(`SELECT status FROM payments WHERE id = $1`, [order.paymentId])).rows[0];
  assert.equal(row.status, "pending");
});

test("Khalti: the cheap payment's pidx cannot settle an expensive order", async () => {
  await initDb();
  const cheap = await seed("khalti", 100, { pidx: `real-${runId}-c1` });
  const expensive = await seed("khalti", 90000, { pidx: `real-${runId}-c2` });
  khaltiLookup = { status: "Completed", transaction_id: `T-${runId}-c1`, total_amount: 10000 };
  // Attacker pays the cheap order for real, then points the expensive order number at that pidx.
  await confirmKhaltiLookup(`real-${runId}-c1`, `${expensive.orderNumber}-${expensive.paymentId}`);
  assert.equal(await orderStatus(cheap.orderNumber), "paid");
  assert.equal(await orderStatus(expensive.orderNumber), "pending_payment");
});

test("Khalti: the legitimate payment still completes", async () => {
  await initDb();
  const order = await seed("khalti", 1921, { pidx: `real-${runId}-d` });
  khaltiLookup = { status: "Completed", transaction_id: `T-${runId}-d`, total_amount: 192100 };
  const result = await confirmKhaltiLookup(`real-${runId}-d`);
  assert.equal(result.verified, true);
  assert.equal(await orderStatus(order.orderNumber), "paid");
});

test("Khalti: one real transaction cannot be replayed on a second payment", async () => {
  await initDb();
  const first = await seed("khalti", 700, { pidx: `real-${runId}-e1` });
  const second = await seed("khalti", 700, { pidx: `real-${runId}-e2` });
  khaltiLookup = { status: "Completed", transaction_id: `T-${runId}-e`, total_amount: 70000 };
  assert.equal((await confirmKhaltiLookup(`real-${runId}-e1`)).verified, true);
  assert.equal((await confirmKhaltiLookup(`real-${runId}-e2`)).verified, false);
  assert.equal(await orderStatus(first.orderNumber), "paid");
  assert.equal(await orderStatus(second.orderNumber), "pending_payment");
});

test("eSewa: paying 1 NPR cannot settle a larger order and eSewa is never asked", async () => {
  await initDb();
  const order = await seed("esewa", 1921);
  calls.length = 0;
  const result = await handleEsewaCallback(
    new URLSearchParams({ oid: `${order.orderNumber}-${order.paymentId}`, refId: `REF-${runId}-1`, amt: "1" }),
  );
  assert.match(result.headers.Location, /\/payment\/failed$/);
  assert.equal(await orderStatus(order.orderNumber), "pending_payment");
  assert.equal(calls.some((c) => c.url.includes("transrec")), false);
});

test("eSewa: the merchant code from the URL is ignored and the right amount settles the order", async () => {
  await initDb();
  const order = await seed("esewa", 1921);
  calls.length = 0;
  esewaResponse = "<response><response_code>Success</response_code></response>";
  const result = await handleEsewaCallback(
    new URLSearchParams({
      oid: `${order.orderNumber}-${order.paymentId}`,
      refId: `REF-${runId}-2`,
      amt: "1,921.0",
      scd: "ATTACKER_MERCHANT",
    }),
  );
  assert.match(result.headers.Location, new RegExp(`/order/${order.orderNumber}\\?success=true`));
  assert.equal(await orderStatus(order.orderNumber), "paid");
  const transrec = calls.find((c) => c.url.includes("transrec"));
  assert.ok(transrec, "eSewa transrec should have been called");
  const merchant = process.env.ESEWA_MERCHANT_CODE || "EPAYTEST";
  assert.ok(transrec.url.includes(`scd=${encodeURIComponent(merchant)}`));
  assert.equal(transrec.url.includes("ATTACKER_MERCHANT"), false);
});

test("eSewa: a pid that does not match its own order number is rejected", async () => {
  await initDb();
  const cheap = await seed("esewa", 100);
  const expensive = await seed("esewa", 50000);
  // Right payment id, wrong order number in the reference.
  const result = await handleEsewaCallback(
    new URLSearchParams({ oid: `${expensive.orderNumber}-${cheap.paymentId}`, refId: `REF-${runId}-3`, amt: "100" }),
  );
  assert.match(result.headers.Location, /\/payment\/failed$/);
  assert.equal(await orderStatus(expensive.orderNumber), "pending_payment");
  assert.equal(await orderStatus(cheap.orderNumber), "pending_payment");
});

test("eSewa: a failed callback cannot flip an already completed payment to failed", async () => {
  await initDb();
  const order = await seed("esewa", 1921);
  esewaResponse = "<response><response_code>Success</response_code></response>";
  await handleEsewaCallback(
    new URLSearchParams({ oid: `${order.orderNumber}-${order.paymentId}`, refId: `REF-${runId}-4`, amt: "1921" }),
  );
  esewaResponse = "<response><response_code>Failure</response_code></response>";
  await handleEsewaCallback(
    new URLSearchParams({ oid: `${order.orderNumber}-${order.paymentId}`, refId: `bogus-${runId}`, amt: "1921" }),
  );
  const row = (await query(`SELECT status FROM payments WHERE id = $1`, [order.paymentId])).rows[0];
  assert.equal(row.status, "completed");
});

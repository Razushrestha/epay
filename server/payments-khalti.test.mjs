import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";

const khaltiCalls = [];
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  khaltiCalls.push({ url, method: init.method || "GET", headers: init.headers || {}, body: init.body || null });
  if (String(url).includes("/epayment/initiate/")) {
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          pidx: "khaltiPidxQA",
          payment_url: "https://test-pay.khalti.com/?pidx=khaltiPidxQA",
        }),
    };
  }
  return {
    ok: true,
    json: async () => ({ status: "Completed", transaction_id: "KHALTITXN001" }),
    text: async () => JSON.stringify({ status: "Completed" }),
  };
};

const { generateKhaltiPaymentUrl, handleKhaltiCallback } = await import("./payments.mjs");
const { query, initDb } = await import("./db.mjs");

test("Khalti initiate posts to v2 epayment and callback lands on /order/:id", async () => {
  await initDb();
  khaltiCalls.length = 0;

  const orderNumber = `ORD-P4${String(Date.now()).slice(-8)}`;
  const order = await query(
    `INSERT INTO orders (buyer_id, order_number, status, subtotal, shipping_amount, tax_amount, total_amount, shipping_name, shipping_phone, donation_amount)
     VALUES (145, $1, 'pending_payment', 1500, 200, 221, 1921, 'Blurry Docs', '9800000000', 0)
     RETURNING *`,
    [orderNumber],
  );
  const payment = await query(
    `INSERT INTO payments (order_id, gateway, amount, status)
     VALUES ($1, 'khalti', 1921, 'pending')
     RETURNING id`,
    [order.rows[0].id],
  );
  const paymentId = payment.rows[0].id;

  const paymentUrl = await generateKhaltiPaymentUrl(order.rows[0], paymentId, {
    host: "localhost:4000",
    origin: "http://localhost:3000",
  });

  assert.equal(khaltiCalls.length >= 1, true);
  assert.equal(khaltiCalls[0].url, "https://khalti.com/api/v2/epayment/initiate/");
  assert.equal(khaltiCalls[0].method, "POST");
  const payload = JSON.parse(khaltiCalls[0].body);
  assert.equal(payload.amount, 192100);
  assert.equal(payload.purchase_order_id, `${orderNumber}-${paymentId}`);
  assert.equal(paymentUrl, "https://test-pay.khalti.com/?pidx=khaltiPidxQA");

  khaltiCalls.length = 0;
  const result = await handleKhaltiCallback(
    new URLSearchParams({
      pidx: "khaltiPidxQA",
      purchase_order_id: `${orderNumber}-${paymentId}`,
    }),
  );
  const lookupCall = khaltiCalls.find((call) => String(call.url).includes("/epayment/lookup/"));
  assert.equal(lookupCall.url, "https://khalti.com/api/v2/epayment/lookup/");
  assert.equal(lookupCall.method, "POST");
  assert.deepEqual(JSON.parse(lookupCall.body), { pidx: "khaltiPidxQA" });
  assert.equal(result.status, 302);
  assert.match(result.headers.Location, new RegExp(`/order/${orderNumber}`));

  const paid = await query("SELECT status FROM orders WHERE order_number = $1", [orderNumber]);
  assert.equal(paid.rows[0].status, "paid");
});

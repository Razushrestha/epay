import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";

const transrecCalls = [];
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  transrecCalls.push({ url, method: init.method || "GET", body: init.body || null });
  return {
    ok: true,
    text: async () => "<response_code>Success</response_code>",
  };
};

const { handleEsewaCallback, verifyEsewaPayment } = await import("./payments.mjs");
const { query, initDb } = await import("./db.mjs");

test("transrec is called with amt, rid, pid, scd and Success XML pays the order", async () => {
  await initDb();
  transrecCalls.length = 0;

  const params = new URLSearchParams({
    amt: "1921.00",
    rid: "TRECQA001",
    pid: "ORD-2026-000006-5",
    scd: "EPAYTEST",
  });

  const verified = await verifyEsewaPayment("1921.00", "TRECQA001", "ORD-2026-000006-5", "EPAYTEST");
  assert.equal(verified, true);
  assert.equal(transrecCalls.length >= 1, true);
  const first = new URL(transrecCalls[0].url);
  assert.equal(`${first.protocol}//${first.host}${first.pathname}`, "https://uat.esewa.com.np/epay/transrec");
  assert.equal(first.searchParams.get("amt"), "1921.00");
  assert.equal(first.searchParams.get("rid"), "TRECQA001");
  assert.equal(first.searchParams.get("pid"), "ORD-2026-000006-5");
  assert.equal(first.searchParams.get("scd"), "EPAYTEST");

  transrecCalls.length = 0;
  const result = await handleEsewaCallback(params);
  assert.equal(result.status, 302);
  assert.match(result.headers.Location, /\/order\/ORD-2026-000006/);
  assert.match(result.headers.Location, /ref=TRECQA001/);

  const payment = await query(
    "SELECT status, gateway_transaction_id FROM payments WHERE id = 5",
  );
  assert.equal(payment.rows[0].status, "completed");
  assert.equal(payment.rows[0].gateway_transaction_id, "TRECQA001");

  const order = await query("SELECT status FROM orders WHERE id = 7");
  assert.equal(order.rows[0].status, "paid");
});

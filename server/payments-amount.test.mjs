import assert from "node:assert/strict";
import test from "node:test";
import { paymentsLiveProblems, productionConfigProblems } from "./security/config-check.mjs";

// payments.mjs opens a lazy database pool but does not connect until a query runs.
process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/unused";
const { esewaAcceptableAmounts, parseGatewayAmount, sameAmount, webhookSignatureValid } = await import("./payments.mjs");

test("gateway amounts parse commas and reject junk", () => {
  assert.equal(parseGatewayAmount("1,921.0"), 1921);
  assert.equal(parseGatewayAmount("100"), 100);
  assert.ok(Number.isNaN(parseGatewayAmount("abc")));
  // A missing amount becomes 0, which never matches a real order (see the next tests).
  assert.equal(parseGatewayAmount(undefined), 0);
});

test("an eSewa payment of 1 NPR cannot satisfy a 1921 NPR order", () => {
  const row = { amount: "1921.00", total_amount: "1921.00", tax_amount: "221.00" };
  const accepted = esewaAcceptableAmounts(row);
  assert.deepEqual(accepted, [1921, 1700]);
  assert.equal(accepted.some((n) => sameAmount(n, 1)), false);
  assert.equal(accepted.some((n) => sameAmount(n, parseGatewayAmount("1,921.0"))), true);
  assert.equal(accepted.some((n) => sameAmount(n, 0)), false);
});

test("zero or missing amounts never become acceptable", () => {
  assert.deepEqual(esewaAcceptableAmounts({ amount: 0, total_amount: 0, tax_amount: 0 }), []);
});

test("webhook signature check rejects a wrong or missing signature", () => {
  const prev = process.env.KHALTI_WEBHOOK_SECRET;
  process.env.KHALTI_WEBHOOK_SECRET = "unit-test-webhook-secret";
  const payload = { pidx: "abc", status: "Completed" };
  assert.equal(webhookSignatureValid("khalti", payload, {}).ok, false);
  assert.equal(webhookSignatureValid("khalti", payload, { "x-khalti-signature": "deadbeef" }).ok, false);
  if (prev === undefined) delete process.env.KHALTI_WEBHOOK_SECRET;
  else process.env.KHALTI_WEBHOOK_SECRET = prev;
});

test("PAYMENTS_LIVE=1 refuses public sandbox payment settings", () => {
  assert.deepEqual(paymentsLiveProblems({}), []);
  const sandbox = paymentsLiveProblems({
    PAYMENTS_LIVE: "1",
    KHALTI_SECRET_KEY: "live_secret_key_68791341fdd94846a146f0457ff7b455",
    ESEWA_SECRET_KEY: "8gBm/:&EnhH.1/q",
    ESEWA_MERCHANT_CODE: "EPAYTEST",
  });
  assert.ok(sandbox.length >= 5);
  const live = {
    PAYMENTS_LIVE: "1",
    KHALTI_SECRET_KEY: "k".repeat(40),
    ESEWA_SECRET_KEY: "s".repeat(20),
    ESEWA_MERCHANT_CODE: "NP-ES-REAL",
    ESEWA_URL: "https://epay.esewa.com.np/api/epay/main/v2/form",
    ESEWA_VERIFY_URL: "https://epay.esewa.com.np/api/epay/transaction/status/",
  };
  assert.deepEqual(paymentsLiveProblems(live), []);
  const strong = "a".repeat(40);
  assert.ok(
    productionConfigProblems({ JWT_SECRET: strong, CORS_ORIGIN: "https://s.example", PAYMENTS_LIVE: "1" }).length > 0,
  );
});

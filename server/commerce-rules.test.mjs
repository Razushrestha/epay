import assert from "node:assert/strict";
import test from "node:test";
import {
  incrementFromRules,
  DEFAULT_INCREMENTS,
  taxAmount,
  shippingFromRate,
  expandQueryWithSynonyms,
  bestMatchScore,
  inQuietHours,
  ledgerLinesBalance,
} from "./commerce-rules.mjs";
import { applyProxyBid, softCloseEndsAt } from "./auctions-math.mjs";

test("increment table by price band", () => {
  assert.equal(incrementFromRules(200, DEFAULT_INCREMENTS), 50);
  assert.equal(incrementFromRules(1200, DEFAULT_INCREMENTS), 100);
  assert.equal(incrementFromRules(8000, DEFAULT_INCREMENTS), 250);
  assert.equal(incrementFromRules(500000, DEFAULT_INCREMENTS), 2500);
});

test("VAT uses configured rate", () => {
  assert.equal(taxAmount(1000, 13), 130);
  assert.equal(taxAmount(1000, 0), 0);
});

test("shipping free above threshold", () => {
  assert.equal(shippingFromRate({ type: "flat", base_rate: 150, free_above_amount: 5000 }, 6000, 200), 0);
  assert.equal(shippingFromRate({ type: "flat", base_rate: 150, free_above_amount: 5000 }, 1000, 200), 150);
  assert.equal(shippingFromRate({ type: "free" }, 10, 200), 0);
});

test("synonym expansion", () => {
  const q = expandQueryWithSynonyms("phone case", [{ term: "phone", synonyms: ["mobile", "smartphone"] }]);
  assert.match(q, /mobile/);
  assert.match(q, /phone/);
});

test("best match ranks quality and freshness", () => {
  const stale = bestMatchScore({ textRank: 0.2, sellerScore: 10, soldCount: 0, publishedAt: "2020-01-01", freeShipping: false });
  const hot = bestMatchScore({ textRank: 0.2, sellerScore: 99, soldCount: 40, publishedAt: new Date().toISOString(), freeShipping: true });
  assert.ok(hot > stale);
});

test("quiet hours wrap midnight", () => {
  assert.equal(inQuietHours("22:00-07:00", new Date("2026-10-09T23:00:00")), true);
  assert.equal(inQuietHours("22:00-07:00", new Date("2026-10-09T12:00:00")), false);
});

test("ledger lines must balance", () => {
  const ok = ledgerLinesBalance([
    { debit: 100, credit: 0 },
    { debit: 0, credit: 100 },
  ]);
  assert.equal(ok.balanced, true);
  const bad = ledgerLinesBalance([{ debit: 50, credit: 0 }]);
  assert.equal(bad.balanced, false);
});

test("proxy bid: higher max takes lead at previous max plus increment", () => {
  const r = applyProxyBid({
    highId: 1,
    highMax: 1000,
    price: 500,
    start: 100,
    bidderId: 2,
    maxAmount: 1500,
    increment: 50,
  });
  assert.equal(r.highId, 2);
  assert.equal(r.price, 1050);
  assert.equal(r.outbidUser, 1);
});

test("proxy bid: equal or lower max keeps earlier leader", () => {
  const r = applyProxyBid({
    highId: 1,
    highMax: 2000,
    price: 500,
    start: 100,
    bidderId: 2,
    maxAmount: 1200,
    increment: 50,
  });
  assert.equal(r.highId, 1);
  assert.equal(r.lostLead, true);
  assert.equal(r.price, 1250);
});

test("soft close extends within window until cap", () => {
  const now = Date.now();
  const soon = new Date(now + 30_000).toISOString();
  const first = softCloseEndsAt(soon, now, 120000, 300000, 8, 0);
  assert.notEqual(first.endsAt, soon);
  assert.equal(first.extensionCount, 1);
  const capped = softCloseEndsAt(soon, now, 120000, 300000, 8, 8);
  assert.equal(capped.extensionCount, 8);
});

import assert from "node:assert/strict";
import test from "node:test";
import { roundUpDonation } from "./donations.mjs";

test("round-up donation goes to the next NPR 10", () => {
  assert.equal(roundUpDonation(541), 9);
  assert.equal(roundUpDonation(540), 10);
  assert.equal(roundUpDonation(1), 9);
  assert.equal(roundUpDonation(0), 0);
  assert.equal(roundUpDonation(-5), 0);
});

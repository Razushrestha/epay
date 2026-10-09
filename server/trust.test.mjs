import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { protectionOpen, strikeAction, scoreRisk, scanContent } from "./trust.mjs";

describe("buyer protection window", () => {
  it("is open within 30 days of delivery", () => {
    const delivered = new Date(Date.now() - 10 * 86400000).toISOString();
    assert.equal(protectionOpen(delivered, 30), true);
  });
  it("closes after the configured days", () => {
    const delivered = new Date(Date.now() - 31 * 86400000).toISOString();
    assert.equal(protectionOpen(delivered, 30), false);
  });
  it("rejects missing delivery dates", () => {
    assert.equal(protectionOpen(null, 30), false);
  });
});

describe("strikes", () => {
  it("warns on the first strike", () => assert.equal(strikeAction(1), "warn"));
  it("restricts on the third strike", () => assert.equal(strikeAction(3), "restrict"));
  it("bans on the fourth strike", () => assert.equal(strikeAction(4), "ban"));
});

describe("trust scoring", () => {
  it("sums event scores", () => assert.equal(scoreRisk([{ score: 10 }, { score: 25 }]), 35));
  it("flags prohibited listing text", () => {
    const scan = scanContent("Brand new firearm for sale");
    assert.equal(scan.flagged, true);
    assert.equal(scan.reason, "prohibited_content");
  });
  it("allows ordinary listings", () => {
    assert.equal(scanContent("Vintage camera in excellent condition").flagged, false);
  });
});

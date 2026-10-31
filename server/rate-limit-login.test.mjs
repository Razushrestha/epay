import assert from "node:assert/strict";
import test from "node:test";
import { RateLimitConfig, checkRateLimit, resetRateLimitStore } from "./security/rate-limit.mjs";

function fakeReq() {
  return {
    headers: { "user-agent": "sec-001", "x-forwarded-for": "203.0.113.10" },
    socket: { remoteAddress: "203.0.113.10" },
  };
}

test("five failed logins allow, sixth is blocked for 30 minutes", () => {
  resetRateLimitStore();
  const req = fakeReq();
  const account = "sec.rate.001@example.com";

  for (let i = 1; i <= 5; i += 1) {
    const result = checkRateLimit(req, RateLimitConfig.AUTH_LOGIN, account);
    assert.equal(result.allowed, true, `attempt ${i} should be allowed`);
  }

  const sixth = checkRateLimit(req, RateLimitConfig.AUTH_LOGIN, account);
  assert.equal(sixth.allowed, false);
  assert.equal(sixth.retryAfter, 30 * 60);
  assert.match(sixth.message, /blocked for 30 minutes/i);
});

test("blocked IP + User-Agent cannot switch email to bypass lockout", () => {
  resetRateLimitStore();
  const req = fakeReq();
  for (let i = 1; i <= 5; i += 1) {
    checkRateLimit(req, RateLimitConfig.AUTH_LOGIN, "sec.rate.001@example.com");
  }
  checkRateLimit(req, RateLimitConfig.AUTH_LOGIN, "sec.rate.001@example.com");
  const otherEmail = checkRateLimit(req, RateLimitConfig.AUTH_LOGIN, "someone.else@example.com");
  assert.equal(otherEmail.allowed, false);
  assert.match(otherEmail.message, /blocked for 30 minutes/i);

  const otherAgent = {
    headers: { "user-agent": "sec-002-other", "x-forwarded-for": "203.0.113.10" },
    socket: { remoteAddress: "203.0.113.10" },
  };
  const differentDevice = checkRateLimit(otherAgent, RateLimitConfig.AUTH_LOGIN, "someone.else@example.com");
  assert.equal(differentDevice.allowed, true);
});

test("register allows 3 attempts per hour then blocks the 4th", () => {
  resetRateLimitStore();
  const req = fakeReq();
  for (let i = 1; i <= 3; i += 1) {
    const result = checkRateLimit(req, RateLimitConfig.AUTH_REGISTER);
    assert.equal(result.allowed, true, `register attempt ${i} should be allowed`);
  }
  const fourth = checkRateLimit(req, RateLimitConfig.AUTH_REGISTER);
  assert.equal(fourth.allowed, false);
  assert.equal(fourth.retryAfter, 60 * 60);
  assert.match(fourth.message, /registration attempts/i);
});

test("verify allows 5 attempts per hour then blocks the 6th", () => {
  resetRateLimitStore();
  const req = fakeReq();
  for (let i = 1; i <= 5; i += 1) {
    const result = checkRateLimit(req, RateLimitConfig.AUTH_VERIFY);
    assert.equal(result.allowed, true, `verify attempt ${i} should be allowed`);
  }
  const sixth = checkRateLimit(req, RateLimitConfig.AUTH_VERIFY);
  assert.equal(sixth.allowed, false);
  assert.equal(sixth.retryAfter, 60 * 60);
  assert.match(sixth.message, /verification attempts/i);
});

test("register lock does not consume verify or login budgets", () => {
  resetRateLimitStore();
  const req = fakeReq();
  for (let i = 1; i <= 3; i += 1) {
    checkRateLimit(req, RateLimitConfig.AUTH_REGISTER);
  }
  checkRateLimit(req, RateLimitConfig.AUTH_REGISTER);
  assert.equal(checkRateLimit(req, RateLimitConfig.AUTH_VERIFY).allowed, true);
  assert.equal(checkRateLimit(req, RateLimitConfig.AUTH_LOGIN).allowed, true);
});

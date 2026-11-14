import assert from "node:assert/strict";
import test from "node:test";
import { RateLimitConfig, checkRateLimit, resetRateLimitStore } from "./security/rate-limit.mjs";
import { clientIp } from "./security/client-ip.mjs";
import { productionConfigProblems } from "./security/config-check.mjs";

function reqFrom(ip, agent = "ua", xff) {
  return {
    headers: { "user-agent": agent, ...(xff ? { "x-forwarded-for": xff } : {}) },
    socket: { remoteAddress: ip },
  };
}

test("rotating the User-Agent cannot bypass the login limit (IP-wide bucket)", () => {
  resetRateLimitStore();
  const max = RateLimitConfig.AUTH_LOGIN.maxAttempts * 6;
  let blocked = false;
  for (let i = 0; i < max + 5; i += 1) {
    const result = checkRateLimit(reqFrom("198.51.100.7", `agent-${i}`), RateLimitConfig.AUTH_LOGIN, `user${i}@x.test`);
    if (!result.allowed) blocked = true;
  }
  assert.equal(blocked, true);
});

test("rotating IPs cannot brute-force one account (account bucket)", () => {
  resetRateLimitStore();
  const max = RateLimitConfig.AUTH_LOGIN.maxAttempts * 2;
  let blocked = false;
  for (let i = 0; i < max + 2; i += 1) {
    const result = checkRateLimit(reqFrom(`203.0.113.${i + 1}`, `agent-${i}`), RateLimitConfig.AUTH_LOGIN, "Victim@X.test");
    if (!result.allowed) blocked = true;
  }
  assert.equal(blocked, true);
  // account key is case-insensitive
  assert.equal(checkRateLimit(reqFrom("192.0.2.200"), RateLimitConfig.AUTH_LOGIN, "victim@x.test").allowed, false);
});

test("global limiter is per-IP and does not affect other clients", () => {
  resetRateLimitStore();
  const cfg = { ...RateLimitConfig.GLOBAL_API, maxAttempts: 3 };
  const a = reqFrom("198.51.100.1");
  for (let i = 0; i < 3; i += 1) assert.equal(checkRateLimit(a, cfg).allowed, true);
  assert.equal(checkRateLimit(a, cfg).allowed, false);
  assert.equal(checkRateLimit(reqFrom("198.51.100.2"), cfg).allowed, true);
});

test("client IP ignores spoofed X-Forwarded-For entries", () => {
  const prev = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = "1";
  // Attacker sends a fake leftmost value; the trusted proxy appended the real peer on the right.
  assert.equal(clientIp(reqFrom("10.0.0.1", "ua", "6.6.6.6, 203.0.113.9")), "203.0.113.9");
  process.env.TRUST_PROXY = "0";
  assert.equal(clientIp(reqFrom("10.0.0.1", "ua", "6.6.6.6")), "10.0.0.1");
  if (prev === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = prev;
});

test("production config rejects default/weak secrets and wildcard CORS", () => {
  const strong = "a".repeat(40);
  assert.deepEqual(productionConfigProblems({ JWT_SECRET: strong, CORS_ORIGIN: "https://shop.example" }), []);
  assert.ok(productionConfigProblems({ CORS_ORIGIN: "https://shop.example" }).some((p) => /JWT_SECRET/.test(p)));
  assert.ok(productionConfigProblems({ JWT_SECRET: "nexlo-dev-jwt", CORS_ORIGIN: "https://s.example" }).length > 0);
  assert.ok(productionConfigProblems({ JWT_SECRET: strong, CORS_ORIGIN: "*" }).some((p) => /CORS_ORIGIN/.test(p)));
  assert.ok(productionConfigProblems({ JWT_SECRET: strong, CORS_ORIGIN: "https://s.example", ALLOW_DEMO_SOCIAL: "1" }).length > 0);
});

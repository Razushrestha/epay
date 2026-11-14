import assert from "node:assert/strict";
import test from "node:test";
import { corsAllowed, corsStreamHeaders, setSecurityHeaders } from "./security/cors.mjs";

test("cors: foreign origins are rejected, local dev origins allowed", () => {
  const prev = { cors: process.env.CORS_ORIGIN, env: process.env.NODE_ENV };
  process.env.CORS_ORIGIN = "";
  process.env.NODE_ENV = "development";
  assert.equal(corsAllowed("https://evil.example"), false);
  assert.equal(corsAllowed("http://localhost:3000"), true);
  assert.equal(corsAllowed(undefined), false);
  process.env.CORS_ORIGIN = "https://shop.example";
  process.env.NODE_ENV = "production";
  assert.equal(corsAllowed("https://shop.example"), true);
  assert.equal(corsAllowed("http://localhost:3000"), false);
  process.env.CORS_ORIGIN = prev.cors ?? "";
  process.env.NODE_ENV = prev.env;
});

test("cors: SSE headers never use a wildcard origin", () => {
  process.env.CORS_ORIGIN = "https://shop.example";
  const ok = corsStreamHeaders({ headers: { origin: "https://shop.example" } });
  assert.equal(ok["Access-Control-Allow-Origin"], "https://shop.example");
  const bad = corsStreamHeaders({ headers: { origin: "https://evil.example" } });
  assert.deepEqual(bad, {});
});

test("security headers are applied to responses", () => {
  const headers = new Map();
  setSecurityHeaders({ setHeader: (k, v) => headers.set(k, v) });
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
});

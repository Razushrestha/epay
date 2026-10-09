import test from "node:test";
import assert from "node:assert/strict";
import { parseGatewayPid, publicApi, publicFrontend } from "./public-urls.mjs";

test("gateway pid keeps dashed order numbers", () => {
  const parsed = parseGatewayPid("ORD-2026-000002-18");
  assert.equal(parsed.orderNumber, "ORD-2026-000002");
  assert.equal(parsed.paymentId, "18");
});

test("API origin prefers Host when env is unset", () => {
  const prev = process.env.API_PUBLIC_URL;
  const render = process.env.RENDER_EXTERNAL_URL;
  delete process.env.API_PUBLIC_URL;
  delete process.env.RENDER_EXTERNAL_URL;
  assert.equal(publicApi({ host: "nexlo-backend.onrender.com", "x-forwarded-proto": "https" }), "https://nexlo-backend.onrender.com");
  if (prev !== undefined) process.env.API_PUBLIC_URL = prev;
  if (render !== undefined) process.env.RENDER_EXTERNAL_URL = render;
});

test("frontend origin uses FRONTEND_URL", () => {
  const prev = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = "https://nexlo.example.com/";
  assert.equal(publicFrontend(), "https://nexlo.example.com");
  if (prev === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = prev;
});

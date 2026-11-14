import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyMailError,
  classifyResendError,
  mailgunBases,
  mailgunWrongRegion,
  maskDestination,
  sendCodeEmail,
} from "./mail.mjs";

test("masks email and phone destinations", () => {
  assert.equal(maskDestination("buyer@nexlo.test", "email"), "b•••@nexlo.test");
  assert.equal(maskDestination("+9779800001234", "phone"), "97••••34");
});

test("mailgun bases include US and EU without duplicates", () => {
  const prev = process.env.MAILGUN_API_URL;
  process.env.MAILGUN_API_URL = "https://api.mailgun.net";
  const bases = mailgunBases();
  assert.ok(bases.includes("https://api.mailgun.net"));
  assert.ok(bases.includes("https://api.eu.mailgun.net"));
  assert.equal(new Set(bases).size, bases.length);
  process.env.MAILGUN_API_URL = prev;
});

test("sandbox and timeout errors are classified for the UI", () => {
  const sandbox = classifyMailError({ status: 403, message: "Please add the address to authorized recipients list" });
  assert.equal(sandbox.retryable, false);
  assert.match(sandbox.userMessage, /authorized recipients/i);

  const timeout = classifyMailError({ name: "AbortError", message: "The operation was aborted" });
  assert.equal(timeout.retryable, true);
  assert.match(timeout.userMessage, /timed out/i);

  const busy = classifyMailError({ status: 503, message: "unavailable" });
  assert.equal(busy.retryable, true);

  const unauthorized = classifyMailError({ status: 401, message: "Forbidden" });
  assert.equal(unauthorized.retryable, true);
  assert.equal(mailgunWrongRegion({ status: 401, message: "Forbidden" }), true);
  assert.equal(mailgunWrongRegion({ status: 404, message: "Domain not found" }), true);
});

test("resend errors are classified for the UI", () => {
  assert.equal(classifyResendError({ status: 403, message: "The meroauction.com domain is not verified" }).retryable, false);
  assert.equal(classifyResendError({ status: 401, message: "API key is invalid" }).retryable, false);
  assert.equal(classifyResendError({ status: 422, message: "Invalid to field" }).retryable, false);
  assert.equal(classifyResendError({ status: 429, message: "Too many requests" }).retryable, true);
  assert.equal(classifyResendError({ status: 503, message: "down" }).retryable, true);
  assert.equal(classifyResendError({ name: "AbortError", message: "aborted" }).retryable, true);
});

test("codes are sent through Resend when RESEND_API_KEY is set", async () => {
  const saved = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM, fetch: globalThis.fetch };
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "MeroAuction <noreply@meroauction.com>";
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ id: "email_123" }) };
  };
  try {
    const result = await sendCodeEmail({ to: "Buyer@Example.com", code: "654321", purpose: "verify" });
    assert.equal(result.sent, true);
    assert.equal(result.id, "email_123");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.resend.com/emails");
    assert.equal(calls[0].init.headers.Authorization, "Bearer re_test_key");
    const body = JSON.parse(calls[0].init.body);
    assert.deepEqual(body.to, ["buyer@example.com"]);
    assert.equal(body.from, "MeroAuction <noreply@meroauction.com>");
    assert.match(body.text, /654321/);
    assert.match(body.html, /654321/);
  } finally {
    globalThis.fetch = saved.fetch;
    if (saved.key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = saved.key;
    if (saved.from === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = saved.from;
  }
});

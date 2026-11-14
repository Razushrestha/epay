import assert from "node:assert/strict";
import test from "node:test";
import { classifyResendError, maskDestination, sendCodeEmail } from "./mail.mjs";

async function withResend(env, fakeFetch, run) {
  const saved = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM, fetch: globalThis.fetch };
  if (env.key === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = env.key;
  if (env.from === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = env.from;
  globalThis.fetch = fakeFetch;
  try {
    await run();
  } finally {
    globalThis.fetch = saved.fetch;
    if (saved.key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = saved.key;
    if (saved.from === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = saved.from;
  }
}

test("masks email and phone destinations", () => {
  assert.equal(maskDestination("buyer@nexlo.test", "email"), "b•••@nexlo.test");
  assert.equal(maskDestination("+9779800001234", "phone"), "97••••34");
});

test("resend errors are classified for the UI", () => {
  assert.equal(classifyResendError({ status: 403, message: "The meroauction.com domain is not verified" }).retryable, false);
  assert.equal(classifyResendError({ status: 401, message: "API key is invalid" }).retryable, false);
  assert.equal(classifyResendError({ status: 422, message: "Invalid to field" }).retryable, false);
  assert.equal(classifyResendError({ status: 429, message: "Too many requests" }).retryable, true);
  assert.equal(classifyResendError({ status: 503, message: "down" }).retryable, true);
  const timeout = classifyResendError({ name: "AbortError", message: "The operation was aborted" });
  assert.equal(timeout.retryable, true);
  assert.match(timeout.userMessage, /timed out/i);
});

test("codes are sent through Resend with the configured sender", async () => {
  const calls = [];
  await withResend(
    { key: "re_test_key", from: "MeroAuction <noreply@meroauction.com>" },
    async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ id: "email_123" }) };
    },
    async () => {
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
    },
  );
});

test("Resend sends from support@meroauction.com when EMAIL_FROM is not set", async () => {
  let sentBody;
  await withResend(
    { key: "re_test_key", from: undefined },
    async (_url, init) => {
      sentBody = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ id: "email_456" }) };
    },
    async () => {
      const result = await sendCodeEmail({ to: "buyer@example.com", code: "111222", purpose: "reset" });
      assert.equal(result.sent, true);
      assert.equal(sentBody.from, "MeroAuction <support@meroauction.com>");
    },
  );
});

test("email is skipped, not crashed, when RESEND_API_KEY is missing", async () => {
  let called = false;
  await withResend(
    { key: undefined, from: undefined },
    async () => {
      called = true;
      return { ok: true, status: 200, json: async () => ({}) };
    },
    async () => {
      const result = await sendCodeEmail({ to: "buyer@example.com", code: "123123", purpose: "verify" });
      assert.equal(result.sent, false);
      assert.equal(result.skipped, true);
      assert.equal(called, false);
    },
  );
});

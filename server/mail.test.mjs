import assert from "node:assert/strict";
import test from "node:test";
import { classifyMailError, mailgunBases, mailgunWrongRegion, maskDestination } from "./mail.mjs";

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

import assert from "node:assert/strict";
import test from "node:test";
import { EMAIL_ERROR, emailError } from "./email.mjs";

test("rejects emails without a domain TLD", () => {
  assert.equal(emailError("test@gmail"), EMAIL_ERROR);
  assert.equal(emailError("user@"), EMAIL_ERROR);
  assert.equal(emailError("user@domain."), EMAIL_ERROR);
  assert.equal(emailError("not-an-email"), EMAIL_ERROR);
  assert.equal(emailError("a@b.c"), EMAIL_ERROR);
});

test("accepts normal email addresses", () => {
  assert.equal(emailError(""), "");
  assert.equal(emailError("test@gmail.com"), "");
  assert.equal(emailError("name.surname@example.co.uk"), "");
  assert.equal(emailError("user+tag@nexlo.com.np"), "");
});

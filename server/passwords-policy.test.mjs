import assert from "node:assert/strict";
import test from "node:test";
import { PASSWORD_POLICY_ERROR, PASSWORD_SPACES_ERROR, passwordPolicyError } from "./passwords.mjs";

test("rejects passwords missing length, number, or special character", () => {
  assert.equal(passwordPolicyError("abcdefg"), PASSWORD_POLICY_ERROR);
  assert.equal(passwordPolicyError("abcdefgh"), PASSWORD_POLICY_ERROR);
  assert.equal(passwordPolicyError("Password"), PASSWORD_POLICY_ERROR);
  assert.equal(passwordPolicyError("password1"), PASSWORD_POLICY_ERROR);
  assert.equal(passwordPolicyError("Password!"), PASSWORD_POLICY_ERROR);
});

test("rejects spaces-only and whitespace-as-special passwords", () => {
  assert.equal(passwordPolicyError("        "), PASSWORD_SPACES_ERROR);
  assert.equal(passwordPolicyError("   "), PASSWORD_SPACES_ERROR);
  assert.equal(passwordPolicyError("password1 "), PASSWORD_POLICY_ERROR);
  assert.equal(passwordPolicyError("1234567 "), PASSWORD_POLICY_ERROR);
});

test("accepts passwords with 8+ chars, a number, and a real special character", () => {
  assert.equal(passwordPolicyError("password1!"), "");
  assert.equal(passwordPolicyError("NexloSec@2026"), "");
  assert.equal(passwordPolicyError("Abcdef1#"), "");
});

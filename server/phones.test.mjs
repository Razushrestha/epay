import assert from "node:assert/strict";
import test from "node:test";
import { nepalMobileDigits, normalizePhone } from "./phones.mjs";

test("Nepal mobiles starting 97 or 98 normalize to +977", () => {
  assert.equal(nepalMobileDigits("9841234567"), "9841234567");
  assert.equal(nepalMobileDigits("9741234567"), "9741234567");
  assert.equal(nepalMobileDigits("+9779841234567"), "9841234567");
  assert.equal(normalizePhone("9841234567"), "+9779841234567");
  assert.equal(nepalMobileDigits("9612345678"), "");
  assert.equal(nepalMobileDigits("984123456"), "");
  assert.equal(nepalMobileDigits("12344556778"), "");
  assert.equal(nepalMobileDigits("abcdefghij"), "");
  assert.equal(nepalMobileDigits("98@#$%^&*("), "");
  assert.equal(nepalMobileDigits("980366170"), "");
  assert.equal(nepalMobileDigits("98036617021"), "");
  assert.equal(normalizePhone("12345"), "");
  assert.equal(normalizePhone("98036617021"), "");
  assert.equal(normalizePhone("9612345678"), "");
});

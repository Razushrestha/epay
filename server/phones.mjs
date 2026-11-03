/** Nepal Ncell/NTC mobiles: 10 digits starting 97 or 98, optional +977. */
export function nepalMobileDigits(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10 && /^(97|98)\d{8}$/.test(digits)) return digits;
  if (digits.length === 13 && /^977(97|98)\d{8}$/.test(digits)) return digits.slice(3);
  return "";
}

/** Nepal mobiles only → +977XXXXXXXXXX. Invalid or empty → "". */
export function normalizePhone(value) {
  const local = nepalMobileDigits(value);
  return local ? `+977${local}` : "";
}

export function phoneLookupKeys(identifier) {
  const key = String(identifier ?? "").trim();
  const digits = key.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return {
    key: key.toLowerCase(),
    e164: normalizePhone(key),
    last10: last10.length === 10 ? last10 : "",
    local: nepalMobileDigits(key),
  };
}

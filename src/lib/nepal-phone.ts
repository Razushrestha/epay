export const NEPAL_PHONE_ERROR =
  "Enter a valid 10-digit Nepal mobile number starting with 97 or 98.";

/** Digits only; max 10 local digits, or 13 when prefixed with 977. */
export function sanitizeNepalPhoneInput(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("977")) return digits.slice(0, 13);
  return digits.slice(0, 10);
}

/**
 * Empty is allowed (optional field). Non-empty values must be a Nepal mobile:
 * 10 digits starting with 97/98, or +977 followed by that local number.
 * Letters and non-phone symbols are rejected (not silently stripped into a valid number).
 */
export function nepalPhoneError(value: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";

  if (/[a-zA-Z]/.test(trimmed)) return NEPAL_PHONE_ERROR;
  if (/[^0-9+\s\-()]/.test(trimmed)) return NEPAL_PHONE_ERROR;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10 && /^(97|98)\d{8}$/.test(digits)) return "";
  if (digits.length === 13 && /^977(97|98)\d{8}$/.test(digits)) return "";
  return NEPAL_PHONE_ERROR;
}

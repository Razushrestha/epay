export const NEPAL_PHONE_ERROR =
  "Enter a valid 10-digit Nepal mobile number starting with 97 or 98.";

export function nepalPhoneError(value: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || (digits.length > 10 && !(digits.length === 13 && digits.startsWith("977")))) {
    return NEPAL_PHONE_ERROR;
  }
  const local = digits.length === 13 ? digits.slice(3) : digits;
  if (!/^(97|98)\d{8}$/.test(local)) return NEPAL_PHONE_ERROR;
  return "";
}

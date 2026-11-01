export const EMAIL_ERROR = "Enter a valid email address (for example, name@example.com).";

/** Requires local@domain.tld with a real TLD (rejects test@gmail). */
export function emailError(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return EMAIL_ERROR;
  const [local, domain] = trimmed.split("@");
  if (!local || !domain) return EMAIL_ERROR;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return EMAIL_ERROR;
  if (domain.startsWith("-") || domain.endsWith("-") || domain.includes("..")) return EMAIL_ERROR;
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(domain)) {
    return EMAIL_ERROR;
  }
  return "";
}

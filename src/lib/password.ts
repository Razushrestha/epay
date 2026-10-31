export function passwordPolicyError(password: string) {
  const value = String(password ?? "");
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    return "Use 8+ characters with mixed case, a number, and a symbol.";
  }
  return "";
}

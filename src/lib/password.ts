export const PASSWORD_POLICY_ERROR =
  "Password must be at least 8 characters, including one number and one special character.";

export const PASSWORD_SPACES_ERROR = "Password cannot be only spaces.";

export function passwordPolicyError(password: string) {
  const value = String(password ?? "");
  if (!value.trim()) return PASSWORD_SPACES_ERROR;
  if (value.length < 8) return PASSWORD_POLICY_ERROR;
  if (!/\d/.test(value)) return PASSWORD_POLICY_ERROR;
  if (!/[^A-Za-z0-9\s]/.test(value)) {
    // Require a real symbol (not whitespace). Spaces alone are not a special character.
    return PASSWORD_POLICY_ERROR;
  }
  return "";
}

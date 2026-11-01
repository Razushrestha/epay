export const NAME_SPACES_ERROR = "Name cannot be only spaces.";

export function nameError(value: string, label = "Name") {
  if (!String(value ?? "").trim()) return `${label} cannot be only spaces.`;
  return "";
}

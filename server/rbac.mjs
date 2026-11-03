import { query } from "./db.mjs";
import { writeAudit } from "./security/audit.mjs";

export async function can(auth, module, action = "read") {
  if (!auth?.is_staff) return false;
  const role = String(auth.staff_role || "none").trim() || "none";
  // Only explicit super_admin bypasses the permission table.
  // "none" is not a grant — assign a role via /admin/roles.
  if (role === "super_admin") return true;
  if (role === "none") return false;
  const { rows } = await query(
    `SELECT 1 FROM staff_permissions WHERE role_id = $1 AND module = $2 AND action = $3`,
    [role, module, action],
  );
  return Boolean(rows[0]);
}

export async function denyUnless(auth, module, action = "read") {
  if (await can(auth, module, action)) return null;
  return { status: 403, body: { error: "You do not have access to this module" } };
}

export async function audit(auth, action, entityType, entityId, extra = {}) {
  try {
    await writeAudit({ query: (text, params) => query(text, params) }, {
      actorId: auth?.user_id ?? auth?.id ?? null,
      actorType: auth?.is_staff ? "staff" : "user",
      action,
      entityType,
      entityId: entityId != null ? String(entityId) : null,
      newValue: extra,
    });
  } catch (err) {
    console.warn("[audit]", err.message);
  }
}

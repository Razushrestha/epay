/** Client-side nav gates. Server `denyUnless` remains the source of truth. */

export type StaffRole = "super_admin" | "moderator" | "finance" | "support" | "catalog" | "none" | string;

/** Maps AdminChrome nav `id` → RBAC module (read). */
export const NAV_MODULE: Record<string, string | null> = {
  dashboard: null, // any staff
  users: "users",
  products: "listings",
  catalog: "catalog",
  orders: "orders",
  payouts: "payouts",
  finance: "finance",
  disputes: "disputes",
  kyc: "kyc",
  appeals: "appeals",
  moderation: "moderation",
  tickets: "tickets",
  cms: "cms",
  trust: "trust",
  audit: "audit",
  messages: "messages",
  reviews: "reviews",
  analytics: "analytics",
  roles: "roles",
  settings: "settings",
  uat: "settings",
};

/** Seeded permissions from migration 007 + 010 (read actions). */
const ROLE_MODULES: Record<string, Set<string>> = {
  moderator: new Set([
    "users",
    "listings",
    "disputes",
    "moderation",
    "trust",
    "kyc",
    "appeals",
    "reviews",
    "audit",
    "cms",
    "settings",
    "tickets",
  ]),
  finance: new Set(["orders", "payouts", "refunds", "ledger", "analytics", "finance", "settings"]),
  support: new Set([
    "users",
    "orders",
    "tickets",
    "messages",
    "disputes",
    "kyc",
    "appeals",
    "cms",
    "settings",
    "audit",
  ]),
  catalog: new Set(["catalog", "listings"]),
};

export function normalizeStaffRole(role?: string | null, isStaff = false): StaffRole {
  const value = String(role || "").trim() || "none";
  if (value !== "none") return value;
  return isStaff ? "support" : "none";
}

export function canAccessNav(role: StaffRole | null | undefined, navId: string, isStaff = true): boolean {
  if (!isStaff) return false;
  const normalized = normalizeStaffRole(role, isStaff);
  if (normalized === "super_admin") return true;
  if (normalized === "none") return false;
  const module = NAV_MODULE[navId];
  if (module == null) return true; // dashboard
  if (module === "roles") return false; // super_admin only
  const allowed = ROLE_MODULES[normalized];
  return Boolean(allowed?.has(module));
}

export type AdminQueues = {
  kyc?: number;
  appeals?: number;
  payouts?: number;
  disputes?: number;
  tickets?: number;
  moderation?: number;
  messages?: number;
};

/** Nav badge key → queues field */
export const NAV_QUEUE_KEY: Record<string, keyof AdminQueues> = {
  kyc: "kyc",
  appeals: "appeals",
  payouts: "payouts",
  disputes: "disputes",
  tickets: "tickets",
  moderation: "moderation",
  messages: "messages",
  products: "moderation",
};

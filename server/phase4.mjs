import { authFromHeaders } from "./commerce-auth.mjs";
import { handleReturns } from "./returns.mjs";
import { handleSellerTools } from "./seller-tools.mjs";
import { handleAdminOps } from "./admin-ops.mjs";
import { handleTrust } from "./trust.mjs";

const ROOTS = new Set(["returns", "cases", "seller", "reports", "site", "help", "tickets"]);
const ADMIN = new Set(["disputes", "moderation", "cms", "tickets", "audit", "trust", "finance", "roles", "strikes", "banners"]);

export function isPhase4Path(pathParts) {
  if (ROOTS.has(pathParts[0])) return true;
  if (pathParts[0] === "admin" && ADMIN.has(pathParts[1])) return true;
  return false;
}

export async function handlePhase4(req, method, pathParts, body) {
  const auth = await authFromHeaders(req.headers);
  const handlers = [handleAdminOps, handleReturns, handleSellerTools, handleTrust];
  for (const fn of handlers) {
    const result = await fn(method, pathParts, auth, body);
    if (result) return result;
  }
  return null;
}

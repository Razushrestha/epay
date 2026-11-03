import fs from "fs";
import path from "path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));
const checks = [];
const ok = (phase, item, pass, detail = "") => checks.push({ phase, item, pass: !!pass, detail });

const rbac = read("server/rbac.mjs");
const staff = read("server/staff.mjs");
const ledger = read("server/ledger.mjs");
const adminOps = read("server/admin-ops.mjs");
const catalog = read("server/catalog.mjs");
const identity = read("server/identity.mjs");
const returns = read("server/returns.mjs");
const router = read("server/router.mjs");
const chrome = read("src/components/admin/AdminChrome.tsx");
const shell = read("src/components/admin/AdminShell.tsx");
const nav = read("src/lib/staff-nav.ts");
const bell = read("src/components/notifications/NotificationBell.tsx");
const trustUi = read("src/app/admin/trust/page.tsx");
const trustSrv = exists("server/trust.mjs") ? read("server/trust.mjs") : "";

// Phase 0
ok(0, "admin-phase0.md", exists("docs/admin-phase0.md"));
ok(0, "migration 010", exists("database/migrations/010_admin_phase0_rbac.sql"));
ok(0, "none is not super_admin", /role === ["']none["']/.test(rbac) && rbac.includes("return false") && rbac.includes("super_admin"));
ok(0, "denyUnless payouts", ledger.includes('denyUnless(auth, "payouts"'));
ok(0, "denyUnless refunds", ledger.includes('denyUnless(auth, "refunds"'));
ok(0, "denyUnless ledger", ledger.includes('denyUnless(auth, "ledger"'));
ok(0, "denyUnless cms", adminOps.includes('denyUnless(auth, "cms"'));
ok(0, "denyUnless catalog", catalog.includes("'catalog'") || catalog.includes('"catalog"'));
ok(0, "denyUnless kyc", identity.includes('denyUnless(actor, "kyc"'));
ok(0, "denyUnless trust", trustSrv.includes("denyUnless") || adminOps.includes('denyUnless(auth, "trust"') || identity.includes('denyUnless(actor, "trust"'));
ok(0, "list envelope helper", exists("server/admin-list.mjs"));
ok(0, "users listEnvelope", identity.includes("listEnvelope"));
ok(0, "orders/listings listEnvelope", staff.includes("listEnvelope"));
ok(0, "CMS banner delete", adminOps.includes("cms.banner_delete"));
ok(0, "CMS page delete", adminOps.includes("cms.page_delete"));
ok(0, "overview queues", staff.includes("queues:") && identity.includes("queues:"));

// Phase 1
ok(1, "staff-nav canAccessNav", nav.includes("canAccessNav") && nav.includes("NAV_QUEUE_KEY"));
ok(1, "AdminChrome queue badges", chrome.includes("NAV_QUEUE_KEY"));
ok(1, "admin search API", staff.includes("/admin/search"));
ok(1, "AdminChrome search UI", chrome.includes("searchHits") || chrome.includes("SearchHit"));
ok(1, "queues SSE route", router.includes("queues/stream") && staff.includes("attachAdminQueuesStream"));
ok(1, "AdminShell SSE client", shell.includes("queues/stream") && shell.includes("EventSource"));
ok(1, "staff inbox drawer", bell.includes('variant === "staff"') || bell.includes("staff inbox"));
ok(1, "dashboard queues", exists("src/app/admin/page.tsx") && read("src/app/admin/page.tsx").includes("queues"));

// Phase 2
for (const p of ["users", "kyc", "appeals", "trust", "roles"]) {
  ok(2, `page /admin/${p}`, exists(`src/app/admin/${p}/page.tsx`));
}
ok(2, "users side panel", read("src/app/admin/users/page.tsx").includes("selected") || read("src/app/admin/users/page.tsx").includes("Selected"));
ok(2, "KYC pending filter", read("src/app/admin/kyc/page.tsx").includes("pending"));
ok(2, "appeals decision note", read("src/app/admin/appeals/page.tsx").includes("reason") || read("src/app/admin/appeals/page.tsx").includes("note"));
ok(2, "trust reason UI", trustUi.includes("reason") && trustUi.includes("length"));
ok(2, "trust reason API", /length\s*<\s*3/.test(trustSrv) || trustSrv.includes("required"));
ok(2, "roles matrix", read("src/app/admin/roles/page.tsx").includes("Permission matrix") || read("src/app/admin/roles/page.tsx").includes("matrix"));
ok(2, "roles PATCH API", adminOps.includes("roles") && adminOps.includes("PATCH"));

// Phase 3
for (const p of ["catalog", "products", "moderation", "reviews"]) {
  ok(3, `page /admin/${p}`, exists(`src/app/admin/${p}/page.tsx`));
}
ok(3, "forceEndAuction API", staff.includes("forceEndAuction"));
ok(3, "listing reject reason gate", staff.includes("A reason is required when rejecting"));
ok(3, "moderation reason gate", adminOps.includes("A reason is required when rejecting or flagging"));
ok(3, "reviews hide", staff.includes("is_hidden") && staff.includes("review.hide"));
ok(3, "reorderCategories fn", catalog.includes("async function reorderCategories"));
ok(3, "catalog Up/Down UI", read("src/app/admin/catalog/page.tsx").includes("moveCategory"));
ok(3, "bulk unpublish UI", read("src/app/admin/products/page.tsx").includes("bulkUnpublish"));

// Phase 4
for (const p of ["orders", "payouts", "finance", "disputes"]) {
  ok(4, `page /admin/${p}`, exists(`src/app/admin/${p}/page.tsx`));
}
ok(4, "order note cancel/refund", staff.includes("A note is required when cancelling or refunding"));
ok(4, "order ledger hooks", staff.includes("onOrderPaid") && staff.includes("releaseEscrow") && staff.includes("refundOrder"));
ok(4, "payout reject note", ledger.includes("Rejection note is required"));
ok(4, "payout integrity UI", read("src/app/admin/payouts/page.tsx").includes("integrity") || read("src/app/admin/payouts/page.tsx").includes("balanced"));
ok(4, "refund reason", ledger.includes("Refund reason is required"));
ok(4, "dual-control REFUND", ledger.includes("confirmPhrase") && ledger.includes("REFUND"));
ok(4, "case decide reason", returns.includes("Decision reason is required"));
ok(4, "finance recon UI", read("src/app/admin/finance/page.tsx").includes("recon") || read("src/app/admin/finance/page.tsx").includes("Gateway"));

// Phase 5
for (const p of ["tickets", "messages", "cms", "settings", "uat"]) {
  ok(5, `page /admin/${p}`, exists(`src/app/admin/${p}/page.tsx`));
}
ok(5, "tickets thread", read("src/app/admin/tickets/page.tsx").includes("thread") || read("src/app/admin/tickets/page.tsx").includes("messages"));
ok(5, "message hide PATCH", staff.includes("is_public") && staff.includes("message.hide"));
ok(5, "CMS delete UI", read("src/app/admin/cms/page.tsx").includes("deleteBanner") && read("src/app/admin/cms/page.tsx").includes("deletePage"));
ok(5, "UAT readiness", read("src/app/admin/uat/page.tsx").includes("readiness"));

// Phase 6
ok(6, "audit CSV", read("src/app/admin/audit/page.tsx").includes("Export CSV"));
ok(6, "analytics page", exists("src/app/admin/analytics/page.tsx"));
ok(6, "saved views lib", exists("src/lib/admin-saved-views.ts") && exists("src/components/admin/SavedViewsBar.tsx"));
ok(6, "orders SavedViewsBar", read("src/app/admin/orders/page.tsx").includes("SavedViewsBar"));
ok(6, "products SavedViewsBar", read("src/app/admin/products/page.tsx").includes("SavedViewsBar"));
ok(6, "users SavedViewsBar", read("src/app/admin/users/page.tsx").includes("SavedViewsBar"));
ok(6, "finance risk strip", read("src/app/admin/finance/page.tsx").includes("Risk") || read("src/app/admin/finance/page.tsx").includes("riskFlags"));

const failed = checks.filter((c) => !c.pass);
const byPhase = {};
for (const c of checks) {
  byPhase[c.phase] ??= { pass: 0, fail: 0, items: [] };
  if (c.pass) byPhase[c.phase].pass += 1;
  else {
    byPhase[c.phase].fail += 1;
    byPhase[c.phase].items.push(c.item);
  }
}

console.log(
  JSON.stringify(
    {
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      byPhase,
      failures: failed,
    },
    null,
    2,
  ),
);
process.exit(failed.length ? 1 : 0);

# Nexlo Admin — phased rollout

Goal: a dynamic marketplace ops console on top of existing `/admin` UI and `/api/v1/admin/*` APIs. Do **not** rewrite commerce rules; harden RBAC, lists, drill-downs, and audit first.

Priority order: **0 → 1 → 2 → 4 → 3 → 5 → 6** (money before catalog polish).

---

## Phase 0 — Foundation

**Goal:** Contract + roles + audit before UI rebuild.

| Work item | Status |
|-----------|--------|
| Document all admin / catalog-admin APIs | Done — see [admin-phase0.md](./admin-phase0.md) |
| Document current vs target RBAC | Done — see [admin-phase0.md](./admin-phase0.md) |
| List gaps (denyUnless coverage, response shape, audit) | Done — see [admin-phase0.md](./admin-phase0.md) |
| Enforce `denyUnless` on money + trust + KYC + CMS + catalog | Done (core P0) |
| Stop treating `staff_role=none` as super_admin | Done |
| Seed kyc/appeals/catalog/cms/settings/audit (+ catalog role) | Done — migration `010_admin_phase0_rbac.sql` |
| Overview `queues` payload for Phase 1 dashboard | Done |
| Standard list envelope `{ data, total, page }` | Done — users/orders/listings + tickets/disputes/payouts |
| Audit remaining holes (listings, CMS delete, etc.) | Done — CMS page/banner delete + listing audits |

**Exit:** Staff APIs documented; role matrix agreed; critical money/trust gates live.

---

## Phase 1 — Command center shell

**Goal:** Actionable home, not a static chart page.

| Work item | Status |
|-----------|--------|
| Role-filtered nav (`src/lib/staff-nav.ts` + `AdminChrome`) | Done |
| Queue badges on nav from `GET /admin/status` | Done |
| Dashboard **Action queues** from `overview.queues` | Done |
| Role-filtered quick actions / queues | Done |
| Global search: user / order / listing | Done — `GET /admin/search` + AdminChrome |
| Staff notification drawer (beyond bell) | Done — staff inbox + live queues |

**Maps to:** `GET /api/v1/admin/overview`, `GET /api/v1/admin/status`, `/admin` page.

---

## Phase 2 — Identity & trust

**Goal:** Resolve a user case without leaving the panel.

| Work item | Status |
|-----------|--------|
| Users: status/role filters + side panel actions | Done |
| KYC: pending/all filters + queue badge | Done |
| Appeals: pending filter + decision note | Done |
| Trust: blacklist + strike forms with required reason | Done |
| Roles permission matrix UI polish | Done |

| UI | API surface |
|----|-------------|
| Users | `GET/POST /admin/users`, `PATCH /admin/users/:id`, `POST /admin/actions` |
| KYC | `GET /admin/kyc`, decision `POST /admin/kyc/:id` |
| Appeals | `GET /admin/appeals`, decide + evidence file |
| Trust | `GET /admin/trust`, `POST /admin/trust/blacklist`, `POST /admin/strikes` |
| Roles | `GET/PATCH /admin/roles` |

---

## Phase 3 — Catalog & listings

| Work item | Status |
|-----------|--------|
| Catalog desk (categories / brands / fees / conditions) | Done (existing + alert polish) |
| Products: filters + detail panel + approve/reject/feature/remove | Done |
| Force-end auction + reject reason gate on listings PATCH | Done |
| Moderation: pending filter + decide drawer + reason on reject/flag | Done |
| Reviews: filters + hide/restore with reason (`is_hidden`) | Done |
| Bulk unpublish / category tree drag-reorder UI | Done — bulk unpublish + sibling Up/Down reorder |

| UI | API surface |
|----|-------------|
| Catalog | `/api/v1/catalog/admin/*` (categories, brands, fees, specifics, restrictions) |
| Products | `GET/PATCH /admin/listings/:id` (+ `forceEndAuction`) |
| Moderation | `GET /admin/moderation`, `POST /admin/moderation/:id` |
| Reviews | `GET /admin/reviews`, `PATCH /admin/reviews/:id` |

Power features: fee edit, force-end auction, hide review, moderation reason audit.

---

## Phase 4 — Commerce & money (highest risk)

| Work item | Status |
|-----------|--------|
| Orders: status filters + detail panel + note-required cancel/refund | Done |
| Payouts: pending filter, reject note, ledger integrity banner | Done |
| Finance: GMV/fees snapshot + refund form (reason required) | Done |
| Disputes: open filter + decide drawer (reason required) | Done |
| API: order notes/history/ledger hooks; payout reject note; refund/case reason gates | Done |
| Dual-control refunds / gateway recon UI | Done — REFUND phrase ≥ NPR 5000 + ledger recon |

| UI | API surface |
|----|-------------|
| Orders | `GET /admin/orders`, `PATCH /admin/orders/:id` |
| Payouts | `GET/PATCH /admin/payouts/:id` |
| Finance | `GET /admin/finance`, `GET /admin/ledger`, `POST /admin/refunds` |
| Disputes | `GET /admin/disputes`, `POST /cases/:id/decide` |

Power features: escrow hooks on paid/completed/refunded, payout approve/reject, refund reason audit.

---

## Phase 5 — Support & content

| Work item | Status |
|-----------|--------|
| Tickets: open filter + thread drawer + reply/resolve/close | Done |
| Messages: open/hidden filters + reply drawer + hide Q&A | Done |
| CMS: pages editor, banners table, protection setting | Done |
| Settings platform form | Done (existing) |
| UAT page polish | Done — readiness % + smoke/checklist |

| UI | API surface |
|----|-------------|
| Tickets | `GET/POST /admin/tickets`, `GET/PATCH /admin/tickets/:id` |
| Messages | `GET /admin/messages`, `POST/PATCH /admin/messages/:id` |
| CMS | `GET /admin/cms`, pages/banners/settings |
| Settings | `GET/PATCH /admin/settings` |
| UAT | `GET /admin/uat` |

---

## Phase 6 — Intelligence & realtime

| Work item | Status |
|-----------|--------|
| Global search across users / orders / listings | Done |
| Audit browser with filter + payload drawer | Done |
| Analytics overview (existing charts) | Done |
| Live SSE/WebSocket for KYC / disputes / payouts | Done — `GET /admin/queues/stream` |
| Risk alerts / CSV export / saved views | Done — risk strip, audit CSV, local saved views |

---

## Definition of done (program)

- Every nav item role-gated **and** server-enforced
- Entity drawers with related records
- Bulk actions on lists
- Confirm + reason on destructive/money actions
- Usable on mobile for trust on-call

---

## Cross-verification (2026-11-03)

| Check | Result |
|-------|--------|
| Static code claims (`scripts/verify-admin-phases.mjs`) | **75/75 PASS** across phases 0–6 |
| Unauthenticated live probes (`:4000`) | All admin routes **401/403** (blocked) |
| Residual RBAC holes found & fixed | `messages` / `settings` `denyUnless`; appeals decide write+audit |

### Known non-blockers

- Gateway recon can report `balanced: false` when payment totals ≠ `PLATFORM_CASH` (data/accounting, not missing UI).
- Platform settings **write** is effectively super_admin-only (`settings` write not seeded to other roles).
- Appeals decision note remains optional in UI (reason gates are hard-required on money/trust/refund paths).
- Mobile on-call usability is layout-responsive but not separately UAT’d.

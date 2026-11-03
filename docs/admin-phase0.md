# Admin Phase 0 — API inventory, RBAC, gaps

Generated from `server/*.mjs` and `database/migrations/007_phase4_returns_admin_trust.sql`.

---

## 1. Roles (seeded)

| Role id | Name | Intent |
|---------|------|--------|
| `super_admin` | Super Admin | Full access (`can()` short-circuits) |
| `moderator` | Moderator | Users, listings, disputes, moderation, trust |
| `finance` | Finance | Orders read, payouts, refunds, ledger, analytics |
| `support` | Support | Users/orders read, tickets, messages, disputes read |
| `none` | (default) | Treated like staff-wide if `is_staff` (see gap) |

Column: `users.staff_role` (default `none`). Staff without an explicit role currently behave as **super_admin** in `rbac.can()` when role is `none` or missing.

---

## 2. Permission matrix (seeded `staff_permissions`)

| Module | moderator | finance | support |
|--------|:---------:|:-------:|:-------:|
| users read/write | R/W | — | R |
| listings read/write | R/W | — | — |
| disputes read/write | R/W | — | R |
| moderation read/write | R/W | — | — |
| trust read/write | R/W | — | — |
| orders read | — | R | R |
| payouts read/write | — | R/W | — |
| refunds read/write | — | R/W | — |
| ledger read | — | R | — |
| analytics read | — | R | — |
| tickets read/write | — | — | R/W |
| messages read/write | — | — | R/W |

**Missing modules in seed (needed for Phase 1–5 nav):** `kyc`, `appeals`, `catalog`, `cms`, `settings`, `audit`, `roles`, `finance` (page vs analytics), `products` (alias of listings).

**Proposed target roles (Phase 0 agreement):**

| Role | Access |
|------|--------|
| `super_admin` | All |
| `moderator` | users, listings, moderation, trust, disputes, kyc, appeals, reviews |
| `finance` | orders, payouts, refunds, ledger, analytics, finance |
| `support` | users, orders, tickets, messages, disputes (read), tickets write |
| `catalog` *(new)* | catalog admin only |

---

## 3. Admin API inventory

### 3.1 Identity / staff (`identity.mjs`, `staff.mjs`)

| Method | Path | Auth today | Notes |
|--------|------|------------|-------|
| GET | `/api/v1/admin/status` | any session | staff count / claim state |
| POST | `/api/v1/admin/claim` | session | first staff bootstrap |
| GET | `/api/v1/admin/overview` | `is_staff` | dashboard KPIs |
| GET | `/api/v1/admin/users` | `is_staff` | search `?q=` |
| POST | `/api/v1/admin/users` | `is_staff` | create staff/user |
| PATCH | `/api/v1/admin/users/:id` | `is_staff` | staff toggle |
| POST | `/api/v1/admin/actions` | `is_staff` | ban / level / etc. |
| GET | `/api/v1/admin/kyc` | `is_staff` | queue |
| POST | `/api/v1/admin/kyc/:id` | `is_staff` | decide |
| GET | `/api/v1/admin/appeals` | `is_staff` | queue |
| GET | `/api/v1/admin/appeals/:id/file` | `is_staff` | evidence |
| POST | `/api/v1/admin/appeals/:id` | `is_staff` | decide |
| GET | `/api/v1/admin/listings` | `is_staff` | product queue |
| PATCH | `/api/v1/admin/listings/:id` | `is_staff` | + audit |
| GET | `/api/v1/admin/orders` | `is_staff` | |
| GET/PATCH | `/api/v1/admin/orders/:id` | `is_staff` | |
| GET | `/api/v1/admin/messages` | `is_staff` | |
| PATCH/DELETE | `/api/v1/admin/messages/:id` | `is_staff` | hide |
| GET | `/api/v1/admin/reviews` | `is_staff` | |
| GET | `/api/v1/admin/settings` | `is_staff` | |
| PATCH | `/api/v1/admin/settings` | `is_staff` | |
| GET | `/api/v1/admin/uat` | `is_staff` | go-live checklist |

### 3.2 Ops / trust (`admin-ops.mjs`, `trust.mjs`)

| Method | Path | `denyUnless` today |
|--------|------|--------------------|
| GET | `/api/v1/admin/disputes` | disputes/read |
| GET | `/api/v1/admin/moderation` | moderation/read |
| POST | `/api/v1/admin/moderation/:id` | moderation/write |
| GET | `/api/v1/admin/cms` | **none** (staff only via phase4) |
| POST | `/api/v1/admin/cms/pages` | **none** |
| POST | `/api/v1/admin/cms/banners` | **none** |
| PATCH | `/api/v1/admin/cms/settings` | **none** |
| GET | `/api/v1/admin/tickets` | **none** |
| POST | `/api/v1/admin/tickets` | **none** |
| GET | `/api/v1/admin/tickets/:id` | **none** |
| PATCH | `/api/v1/admin/tickets/:id` | tickets/write |
| GET | `/api/v1/admin/audit` | **none** |
| GET | `/api/v1/admin/finance` | analytics/read |
| GET | `/api/v1/admin/roles` | **none** |
| PATCH | `/api/v1/admin/roles` | super_admin only |
| GET | `/api/v1/admin/trust` | **none** |
| POST | `/api/v1/admin/trust/blacklist` | **none** (+ audit) |
| POST | `/api/v1/admin/strikes` | **none** (+ audit) |

Public (non-admin) helpers in same handlers: `GET /site/banners`, `GET /help`, user `POST /tickets`.

### 3.3 Ledger / payouts (`ledger.mjs`)

| Method | Path | Auth today |
|--------|------|------------|
| GET | `/api/v1/admin/payouts` | `is_staff` only |
| PATCH | `/api/v1/admin/payouts/:id` | `is_staff` only |
| POST | `/api/v1/admin/refunds` | `is_staff` only |
| GET | `/api/v1/admin/ledger` | `is_staff` only |

**Gap:** no `denyUnless(auth, "payouts"|"refunds"|"ledger", …)` — any staff can move money.

### 3.4 Catalog admin (`catalog.mjs` under `/api/v1/catalog/admin`)

| Method | Path | Auth |
|--------|------|------|
| GET | `/catalog/admin/fees` | staff session |
| PUT/PATCH | `/catalog/admin/fees/:id` | staff |
| POST/PATCH/DELETE | `/catalog/admin/categories[/:id]` | staff |
| POST | `/catalog/admin/categories/reorder` | staff |
| PUT | `/catalog/admin/categories/:id/fees` | staff |
| POST/PATCH/DELETE | `/catalog/admin/specifics[/:id]` | staff |
| POST/PATCH/DELETE | `/catalog/admin/brands[/:id]` | staff |
| POST/DELETE | `/catalog/admin/restrictions[/:id]` | staff |

**Gap:** no module `catalog` in `staff_permissions`; any `is_staff` can edit catalog.

---

## 4. UI map (`src/app/admin`)

| Route | Primary APIs |
|-------|----------------|
| `/admin` | overview |
| `/admin/users` | users, actions |
| `/admin/products` | listings |
| `/admin/catalog` | catalog/admin/* |
| `/admin/orders` | orders |
| `/admin/payouts` | payouts |
| `/admin/finance` | finance, ledger, refunds |
| `/admin/disputes` | disputes |
| `/admin/kyc` | kyc |
| `/admin/appeals` | appeals |
| `/admin/moderation` | moderation |
| `/admin/tickets` | tickets |
| `/admin/cms` | cms |
| `/admin/trust` | trust, strikes |
| `/admin/audit` | audit |
| `/admin/messages` | messages |
| `/admin/reviews` | reviews |
| `/admin/analytics` | overview / finance series |
| `/admin/roles` | roles |
| `/admin/settings` | settings |
| `/admin/uat` | uat |
| `/admin/login` | auth |

---

## 5. Phase 0 gaps (action list)

### P0 — Security / money

1. **Wire `denyUnless` on payouts, refunds, ledger, KYC, appeals, users writes, listings writes, catalog admin, trust/blacklist/strikes, CMS writes, audit read.**  
   Today many routes only check `is_staff`.
2. **Fix `staff_role = 'none'`** for staff users → do not grant super_admin via `can()` short-circuit; require explicit role or default to `support`.
3. **Require reason** on ban, KYC reject, refund, payout reject (API validation).

### P1 — Contract

4. Standard list response: `{ data, total, page, pageSize }` (or cursor) on users, orders, listings, tickets, payouts.
5. OpenAPI or `scripts/admin-api-inventory.json` kept in sync with routes.
6. Seed missing permissions: `kyc`, `appeals`, `catalog`, `cms`, `settings`, `audit`, `roles`.

### P2 — Audit completeness

7. Ensure `audit()` on: KYC decide, appeals decide, user ban, refund, payout decide, catalog delete, CMS publish (several already call `audit` / `writeAudit`; fill holes).
8. Admin UI: show actor + timestamp on decision screens.

### P3 — Product for Phase 1

9. Overview payload: add **queue counts** (pending KYC, open cases, pending payouts, open tickets, flagged listings) in one `GET /admin/overview` field `queues`.
10. Nav filter by `staffRole` + `can(module)` on client (server remains source of truth).

---

## 6. Recommended next engineering steps

1. Migration: seed catalog/kyc/appeals/cms/settings/audit permissions; stop treating `none` as super_admin.  
2. Helper `requireStaffModule(auth, module, action)` used at top of every admin handler.  
3. Extend `GET /admin/overview` with `queues`.  
4. Then start **Phase 1** shell (actionable dashboard + role-filtered nav).

---

## 7. `denyUnless` coverage snapshot

| Area | Enforced via `denyUnless`? |
|------|----------------------------|
| disputes read | Yes |
| moderation read/write | Yes |
| tickets write (patch) | Yes |
| finance page (analytics read) | Yes |
| roles PATCH | Super-admin string check |
| payouts / refunds / ledger | **No** — `is_staff` only |
| KYC / appeals / users / listings | **No** — `is_staff` only |
| catalog admin | **No** — staff token check |
| trust / strikes / CMS / audit GET | **No** / partial |

# 8. Database design

Canonical field lists for all tables are in the proposal **§5 Data models and fields**. This document captures storage split, invariants, ledger, indexing, and backup.

## 8.1 What is stored where

| Data | Store |
|------|--------|
| Users, listings, bids, offers, orders, payments, ledger, cases, feedback | **PostgreSQL** (source of truth) |
| Per-listing item specifics | PostgreSQL **JSONB** (`attributes`), schema per category |
| Live auction price / leader (read cache) | **Redis**, backed by PostgreSQL `auctions` row |
| Search documents | **OpenSearch**, built from events; fully rebuildable |
| Sessions, rate limits, distributed locks | **Redis** |
| Images, KYC, invoices, evidence | **Object storage**; metadata in PostgreSQL |

## 8.2 Design rules

- Money: integers in **smallest unit** (`*_minor`) + `currency`. **No floats** for money.
- Every table: numeric `id` + **public UUID** (`public_id`) for URLs where applicable.
- Timestamps: **UTC** in DB; display in user timezone.
- Financial rows and bids: **never deleted**. User-facing rows: **soft delete** (`deleted_at`).
- Orders store **snapshots** (title, price, address) — listing edits do not rewrite history.
- Hot rows (`listings`, `auctions`, `orders`): **`version`** for optimistic locking.
- Status columns: CHECK constraints or enums; important transitions → **history tables**.
- Append-only high-volume tables (`bids`, `ledger_entries`, `notifications`, `audit_logs`, …): **partition by month**.

## 8.3 Double-entry ledger

All money movement = balanced debit/credit lines sharing a `txn_id`. **Insert-only**; corrections use **reversing entries**.

| Event | Debit | Credit |
|-------|-------|--------|
| Buyer payment captured | `gateway_clearing` | `escrow` |
| Escrow released (delivery / window) | `escrow` | `seller_wallet` (net), `platform_revenue` (fee), `tax_payable` |
| Refund to buyer | `escrow` | `gateway_clearing` |
| Payout to seller | `seller_wallet` | `gateway_clearing` |

Nightly job: every transaction balances; each account balance equals sum of entries.

## 8.4 Indexing, scaling, backup

- Composite / partial indexes for real queries (e.g. active listings by `end_at`).
- **PgBouncer**; one primary + read replicas for browse and reports.
- Heavy search/filtering on **OpenSearch**, not on transactional PostgreSQL.
- WAL archiving + daily snapshots (off-site). Target **RPO 5 min**, **RTO 1 hour**.
- Retention per Nepal legal requirements; purge expired sessions and OTP rows on schedule.

## 8.5 Schema artifacts (repo)

| Path | Purpose |
|------|---------|
| [`../database/README.md`](../database/README.md) | Conventions and migration workflow |
| `database/migrations/` | Versioned SQL migrations (to be added per module) |

OpenSearch index mappings and Redis key conventions will live under `docs/` runbooks as they are defined.

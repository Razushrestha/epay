# Database

PostgreSQL 16 is the system of record. See [docs/08-database-design.md](../docs/08-database-design.md).

## Conventions

- Table and column names: `snake_case`.
- Money: `*_minor` (integer) + `currency` (default `NPR`).
- Public identifiers: `public_id` UUID on user-facing entities.
- All tables: `created_at`, `updated_at`; soft-delete tables: `deleted_at`.

## Migrations

Place versioned SQL (or ORM migrations) in `database/migrations/`. Rules:

- Backward compatible roll-forward only for zero-downtime deploys.
- Never migrate money or bids with destructive DDL.
- Partition new high-volume tables by month from day one where listed in §8.

## Local database

Start PostgreSQL via [infra/docker-compose.yml](../infra/docker-compose.yml):

```bash
docker compose -f infra/docker-compose.yml up -d postgres
```

Default connection (local only):

`postgresql://nexlo:nexlo@localhost:5433/nexlo` (host port **5433** if local Postgres uses 5432)

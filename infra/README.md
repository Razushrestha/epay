# Infrastructure (local)

Docker Compose stack for development aligned with proposal §6.2.

## Services

| Service | Port | Purpose |
|---------|------|---------|
| postgres | 5433 → 5432 | Primary database (host 5433 avoids clash with local Postgres) |
| redis | 6380 → 6379 | Cache, locks, pub/sub |
| opensearch | 9200 | Search (single-node dev) |
| rabbitmq | 5672, 15672 | Queues (+ management UI) |

## Usage

```bash
docker compose -f infra/docker-compose.yml up -d
```

Copy `infra/.env.example` to `.env` at repo root when wiring NestJS API (future).

Storefront (current): `npm run dev` at repo root.

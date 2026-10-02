# Nexlo

Full-stack starter with **Next.js** (React, App Router, TypeScript, Tailwind) and a small **Node.js** HTTP API.

## Requirements

- [Node.js](https://nodejs.org/) 20+ (18+ should work)

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server at [http://localhost:3000](http://localhost:3000) |
| `npm run dev:api` | Standalone Node API at [http://localhost:4000](http://localhost:4000) |
| `npm run dev:all` | Next.js + Node API together |
| `npm run db:up` | Start PostgreSQL + Redis (Docker; ports 5433 / 6380) |
| `npm run db:migrate` | Apply SQL migrations |

**Local DB without Docker:** set `USE_PGLITE=1` in `.env` (default). Data is stored in `.data/pglite`. For production-like dev, use Docker Postgres and set `USE_PGLITE=0`.
| `npm run build` | Production build |
| `npm run start` | Run production Next.js |
| `npm run lint` | ESLint |

## Project layout

- `src/app/` — Next.js pages and route handlers
- `src/app/api/` — Next.js API routes (Node runtime)
- `server/` — Standalone Node.js server (`server/index.mjs`)
- `docs/` — System architecture (§6–§11), ER diagrams, flows, algorithms
- `database/` — Migration conventions and schema home
- `infra/` — Docker Compose (PostgreSQL, Redis, OpenSearch, RabbitMQ)

Architecture index: [docs/README.md](./docs/README.md).

**Full proposal breakdown & 4-month phases:** [phases/README.md](./phases/README.md) (every §4 feature, §5 table, milestones M1–M4, cost, client duties).

## Health checks

- Next: `GET http://localhost:3000/api/health`
- Node: `GET http://localhost:4000/health`

Optional: set `API_PORT` to change the Node server port.

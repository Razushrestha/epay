# §12 Server, storage and payment (client)

Client provides and pays for infrastructure; vendor configures and deploys.

## 12.1 Split

| Item | Client | Vendor |
|------|--------|--------|
| App, DB, search servers | Provide | Configure, deploy, tune |
| Object storage, CDN, backups | Provide | Integrate, lifecycle, test restore |
| Domain, SSL | Provide | Configure |
| Payment merchant accounts | Provide | Integrate ≤2 gateways |
| SMS, email accounts | Provide | Integrate + templates |
| Software, docs | — | Deliver §16 |

## 12.2 Launch server sizing (starting point)

~50k daily visitors, ~100k active listings (resize after month 4 load test).

| Role | Qty | Size |
|------|-----|------|
| App (storefront + API) | 2 | 2 vCPU, 4 GB RAM each |
| Realtime | 1 | 2 vCPU, 4 GB RAM |
| Worker | 1 | 2 vCPU, 4 GB RAM |
| PostgreSQL primary | 1 | 4 vCPU, 16 GB RAM SSD |
| PostgreSQL replica | 1 | 4 vCPU, 16 GB RAM SSD |
| Redis | 1 | 2 GB RAM |
| OpenSearch | 1–2 | 4 GB RAM SSD each |
| RabbitMQ | 1 | 2 vCPU, 2 GB RAM |
| Staging | 1 | 4 vCPU, 8 GB RAM |

OS: Ubuntu LTS; NTP required for auction end times.

## 12.3 Storage

- Object storage: 500 GB–1 TB public images; **private bucket** for KYC/invoices
- DB disk: ≥200 GB SSD expandable
- Backups: daily snapshots + WAL off-site, 30-day retention; CDN on public bucket

## 12.4 Payment

- Card/wallet data **only on gateway hosted page**
- Webhooks = source of truth (not browser redirect)
- Platform ledger + daily reconciliation vs gateway
- Seller payouts via client bank/gateway; client pays gateway fees
- **Regulatory:** client confirms Nepal Rastra Bank / escrow rules; software can disable escrow if needed

# §3 User roles

| Role | Capabilities |
|------|----------------|
| **Guest** | Browse, search, view listings and seller profiles; must register to bid/buy |
| **Buyer** | Bid, buy, offers, pay, track orders, message sellers, returns, cases, feedback, watchlist, saved searches |
| **Seller** | All buyer actions + KYC, create/manage listings, ship, offers/returns/cases, dashboard, payouts |
| **Support agent** | Tickets, moderate listings/messages, dispute queue |
| **Finance officer** | Fees, approve payouts/refunds, ledger, reconciliation reports |
| **Administrator** | Full control: users, roles, catalog, settings, content, audit log |

**Implementation note:** Buyer and seller share one **user account**; `account_type` individual or business; staff via `admin_users` + RBAC.

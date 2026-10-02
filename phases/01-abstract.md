# §1 Abstract

eBay-style auction marketplace: sellers list (auction / fixed / Best Offer); buyers bid, buy, pay; escrow, feedback, returns, disputes.

**Architecture:** modular monolith — API + realtime gateway + worker; PostgreSQL, Redis, OpenSearch, object storage; double-entry ledger + proxy bidding with server locks.

**Scope:** responsive web storefront + admin back-office. **No native apps.**

**Delivery:** 4 months, NPR 13,00,000 excl. VAT. Client provides servers, storage, payment, SMS, email.

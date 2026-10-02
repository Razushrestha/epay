# 9. ER diagrams

Six diagrams (proposal §9). Cardinality: `||--o{` = one-to-many; optional parent shown with `o|--`.

Full table definitions: proposal **§5**.

---

## Diagram 1 — Users and catalog

```mermaid
erDiagram
  users ||--o| user_profiles : has
  users ||--o| business_profiles : has
  users ||--o{ addresses : has
  users ||--o{ kyc_documents : submits
  users ||--o{ auth_sessions : has
  users ||--o| two_factor : has
  users ||--o{ account_restrictions : has

  categories ||--o{ categories : parent
  categories ||--o{ category_attributes : defines
  category_attributes ||--o{ attribute_values : has
  categories ||--o{ restricted_rules : has

  conditions ||--o{ listings : classifies
  brands ||--o{ listings : optional

  users {
    bigint id PK
    uuid public_id
    string email
    string status
    string seller_level
  }

  categories {
    bigint id PK
    bigint parent_id FK
    string slug
    int commission_bp
  }

  kyc_documents {
    bigint id PK
    bigint user_id FK
    string status
  }
```

---

## Diagram 2 — Listings and auctions

```mermaid
erDiagram
  users ||--o{ listings : sells
  categories ||--o{ listings : categorizes
  listings ||--o{ listing_media : has
  listings ||--o{ listing_variations : has
  listings ||--|| listing_policies : has
  listings ||--o{ listing_fees : incurs
  listings ||--|| auctions : auction_format
  listings ||--o{ bids : receives
  increment_rules ||--o{ auctions : applies
  users ||--o{ bids : places
  users ||--o{ blocked_bidders : blocked_as

  listings {
    bigint id PK
    uuid public_id
    bigint seller_id FK
    string listing_type
    string status
    jsonb attributes
  }

  auctions {
    bigint listing_id PK_FK
    bigint current_price_minor
    bigint leader_id FK
    timestamptz end_at
    string status
  }

  bids {
    bigint id PK
    bigint listing_id FK
    bigint bidder_id FK
    bigint amount_minor
    bigint max_minor
    timestamptz placed_at
  }
```

---

## Diagram 3 — Best Offer

```mermaid
erDiagram
  listings ||--o{ offers : receives
  listings ||--o| offer_rules : configures
  users ||--o{ offers : buyer
  users ||--o{ offers : seller
  offers ||--o{ offer_counters : negotiates
  listings ||--o{ second_chance_offers : after_unpaid

  offers {
    bigint id PK
    bigint listing_id FK
    bigint buyer_id FK
    bigint price_minor
    string status
    timestamptz expires_at
  }

  offer_counters {
    bigint id PK
    bigint offer_id FK
    string from_role
    bigint price_minor
  }

  offer_rules {
    bigint listing_id PK_FK
    bigint auto_accept_minor
    bigint auto_decline_minor
  }
```

---

## Diagram 4 — Orders and fulfilment

```mermaid
erDiagram
  users ||--o{ orders : buyer
  users ||--o{ orders : seller
  orders ||--o{ order_items : contains
  orders ||--o{ order_status_history : tracks
  orders ||--o{ order_addresses : snapshots
  orders ||--o{ shipments : ships
  shipments ||--o{ tracking_events : tracks
  orders ||--o{ returns : may_have
  returns ||--o| return_shipments : ships_back
  orders ||--o| feedback : receives

  orders {
    bigint id PK
    string order_no
    string source
    string status
    bigint total_minor
  }

  order_items {
    bigint id PK
    bigint order_id FK
    bigint listing_id FK
    jsonb attributes_snapshot
  }

  shipments {
    bigint id PK
    bigint order_id FK
    string tracking_number
    string status
  }
```

---

## Diagram 5 — Payments and payouts

```mermaid
erDiagram
  orders ||--o{ payments : paid_by
  orders ||--o| escrow_holds : secures
  orders ||--o{ order_fees : charged
  orders ||--o{ refunds : may_have
  orders ||--o| invoices : documents
  users ||--|| seller_wallets : owns
  users ||--o{ payout_accounts : configures
  users ||--o{ payouts : receives
  payments ||--o{ payment_webhooks : confirms

  ledger_accounts ||--o{ ledger_entries : posts
  payments {
    bigint id PK
    bigint order_id FK
    bigint amount_minor
    string status
  }

  escrow_holds {
    bigint id PK
    bigint order_id FK
    bigint amount_minor
    string status
  }

  ledger_entries {
    bigint id PK
    uuid txn_id
    bigint account_id FK
    string direction
    bigint amount_minor
  }

  payouts {
    bigint id PK
    bigint seller_id FK
    bigint net_minor
    string status
  }
```

---

## Diagram 6 — Disputes and ledger (cases)

```mermaid
erDiagram
  orders ||--o{ cases : dispute
  cases ||--o{ case_messages : thread
  cases ||--o{ case_evidence : files
  cases ||--o| case_decisions : resolves
  users ||--o{ case_messages : sends

  cases {
    bigint id PK
    bigint order_id FK
    string case_type
    string status
    bigint amount_claimed_minor
  }

  case_decisions {
    bigint id PK
    bigint case_id FK
    string outcome
    bigint refund_minor
  }

  ledger_accounts {
    bigint id PK
    string owner_type
    string type
  }
```

### Tables omitted from diagrams

Carts, coupons, conversations, messages, notifications, fee rules, admin/system tables (see proposal §5.5–5.9) attach to **users**, **listings**, or **orders** with the same pattern.

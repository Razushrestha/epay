# §5 Data models — Search, cart, payments, orders

## 5.5 Search, cart, checkout

| Table | Fields |
|-------|--------|
| **search document** (OpenSearch) | listing_id, title, description, category_path, attributes, condition, price, currency, listing_type, end_at, seller_id, seller_score, location, free_shipping, image_url, sold_count, popularity_score |
| **saved_searches** | id, user_id, query (JSONB), alert_frequency, channel, last_run_at |
| **watchlist_items** | id, user_id, listing_id, alert_on_price_drop, alert_before_end, added_at |
| **recently_viewed** | user_id, listing_id, viewed_at |
| **search_synonyms** | id, term, synonyms, language |
| **carts** | id, user_id, currency, created_at, updated_at, expires_at |
| **cart_items** | id, cart_id, listing_id, variation_id, seller_id, quantity, unit_price_minor, added_at |
| **stock_reservations** | id, listing_id, variation_id, user_id, quantity, expires_at |
| **coupons** | id, code, type, value, min_order_minor, max_discount_minor, usage_limit, per_user_limit, valid_from, valid_to, funded_by |
| **coupon_usages** | id, coupon_id, user_id, order_id, used_at |
| **tax_rules** | id, country, category_id, rate_bp, tax_type, is_inclusive, effective_from |
| **shipping_rates** | id, service_id, zone_from, zone_to, weight_from_g, weight_to_g, rate_minor |

## 5.6 Payments, escrow, ledger

| Table | Fields |
|-------|--------|
| **payments** | id, order_id, buyer_id, amount_minor, currency, method, gateway, gateway_txn_id, status, failure_reason, paid_at |
| **payment_webhooks** | id, gateway, event_id, payload, signature_valid, processed_at |
| **ledger_accounts** | id, owner_type, owner_id, currency, type |
| **ledger_entries** | id, txn_id, account_id, direction, amount_minor, ref_type, ref_id, created_at |
| **escrow_holds** | id, order_id, amount_minor, held_at, release_condition, release_at, released_at, status |
| **seller_wallets** | id, seller_id, balance_minor, hold_minor, currency |
| **payout_accounts** | id, seller_id, type, bank_name, account_name, account_number (encrypted), branch, verified |
| **payouts** | id, seller_id, amount_minor, fee_minor, net_minor, status, initiated_at, completed_at, reference |
| **fee_rules** | id, category_id, seller_level, fee_type, percent_bp, fixed_minor, cap_minor, effective_from |
| **order_fees** | id, order_id, fee_type, amount_minor, rule_id |
| **refunds** | id, order_id, payment_id, amount_minor, reason, initiated_by, status, processed_at |
| **invoices** | id, order_id, invoice_no, issued_at, line_items (JSONB), tax_breakdown (JSONB), total_minor, pdf_url |

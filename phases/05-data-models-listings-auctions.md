# §5 Data models — Listings, auctions, offers

## 5.3 Listings

| Table | Fields |
|-------|--------|
| **listings** | id, public_id, seller_id, category_id, title, subtitle, description, condition_id, listing_type, status, currency, buy_now_price_minor, start_price_minor, reserve_price_minor, quantity, quantity_available, item_country, item_city, start_at, end_at, duration_days, relist_count, view_count, watch_count, attributes (JSONB), version, timestamps |
| **listing_media** | id, listing_id, url, thumb_url, sort_order, is_primary, width, height, file_size, moderation_status |
| **listing_variations** | id, listing_id, sku, attribute_combo, price_minor, quantity, media_id |
| **listing_policies** | listing_id, handling_days, free_shipping, shipping_cost_minor, ship_to_countries, returns_accepted, return_window_days, return_shipping_paid_by |
| **listing_drafts** | id, seller_id, data (JSONB), saved_at |
| **listing_revisions** | id, listing_id, changed_fields (JSONB), changed_by, changed_at |
| **listing_fees** | id, listing_id, fee_type, amount_minor, charged_at |
| **listing_reports** | id, listing_id, reporter_id, reason, details, status, resolved_by |
| **bulk_uploads** | id, seller_id, file_url, total_rows, success_count, error_count, error_report_url, status |

## 5.4 Auctions and offers

| Table | Fields |
|-------|--------|
| **auctions** | listing_id, start/current/reserve prices, reserve_met, leader_id, leader_max_minor, bid_count, increment_rule_id, end_at, extension_count, status, winner_id, winning_bid_id |
| **bids** | id, listing_id, bidder_id, amount_minor, max_minor, bid_type, status, placed_at, ip, device_id |
| **increment_rules** | id, price_from_minor, price_to_minor, increment_minor |
| **bid_retractions** | id, bid_id, reason, requested_at, approved |
| **blocked_bidders** | seller_id, blocked_user_id, reason |
| **second_chance_offers** | id, listing_id, user_id, price_minor, expires_at, status |
| **unpaid_strikes** | id, user_id, order_id, created_at, expires_at |
| **offers** | id, listing_id, variation_id, buyer_id, seller_id, quantity, price_minor, message, status, expires_at, created_at |
| **offer_counters** | id, offer_id, from_role, price_minor, message, created_at |
| **offer_rules** | listing_id, auto_accept_minor, auto_decline_minor, max_counters |

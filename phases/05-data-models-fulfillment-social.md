# §5 Data models — Orders, returns, messaging, admin

## 5.7 Orders, shipping, returns, disputes

| Table | Fields |
|-------|--------|
| **orders** | id, order_no, buyer_id, seller_id, source (auction/fixed/offer), status, payment_status, subtotal/shipping/tax/discount/total_minor, currency, placed_at, paid_at, shipped_at, delivered_at, completed_at, cancelled_at, cancel_reason |
| **order_items** | id, order_id, listing_id, variation_id, title_snapshot, sku, unit_price_minor, quantity, item_tax_minor, attributes_snapshot (JSONB) |
| **order_status_history** | id, order_id, from_status, to_status, changed_by, note, at |
| **order_addresses** | order_id, type, snapshot (JSONB) |
| **cancellations** | id, order_id, requested_by, reason, status, seller_response |
| **shipping_policies** | id, seller_id, name, handling_days, services (JSONB), free_shipping_threshold_minor, excluded_regions, local_pickup |
| **shipping_services** | id, name, delivery_min/max_days, cost_type, base_cost_minor |
| **shipments** | id, order_id, carrier, service_id, tracking_number, weight_g, cost_minor, status, shipped_at, delivered_at |
| **tracking_events** | id, shipment_id, status, location, description, event_time |
| **returns** | id, order_id, item_id, buyer_id, seller_id, reason, detail, requested_resolution, status, requested_at |
| **return_shipments** | id, return_id, carrier, tracking_number, shipped_at, received_at |
| **cases** | id, order_id, buyer_id, seller_id, case_type, status, amount_claimed_minor, opened_at, seller_response_due, escalated_at, closed_at |
| **case_messages** | id, case_id, sender_id, role, body, attachments, sent_at |
| **case_evidence** | id, case_id, uploaded_by, file_url, type |
| **case_decisions** | id, case_id, decided_by, outcome, refund_minor, seller_penalty, reason, decided_at |

## 5.8 Feedback, messaging, seller

| Table | Fields |
|-------|--------|
| **feedback** | id, order_id, from_user_id, to_user_id, role, rating, comment, seller_reply, created_at |
| **seller_ratings** | feedback_id, item_as_described, communication, shipping_speed, shipping_cost |
| **seller_metrics** | seller_id, period, defect_rate, late_shipment_rate, unresolved_cases_rate, tracking_upload_rate, total_sales |
| **conversations** | id, buyer_id, seller_id, listing_id, order_id, last_message_at, status |
| **messages** | id, conversation_id, sender_id, body, attachments, is_read, read_at, flagged, sent_at |
| **notifications** | id, user_id, type, title, body, data (JSONB), channel, is_read, status, sent_at |
| **notification_templates** | id, event, channel, subject, body, language |
| **notification_preferences** | user_id, event_type, channels, quiet_hours |
| **seller_dashboard_stats** | seller_id, date, sales_minor, orders, views, conversion_rate |
| **vacation_mode** | seller_id, starts_at, ends_at, message, hide_listings |
| **saved_replies** | id, seller_id, title, body |

## 5.9 Admin, trust, system

| Table | Fields |
|-------|--------|
| **admin_users** | id, name, email, role_id, status, last_login_at |
| **roles / permissions** | roles(id, name); permissions(id, role_id, module, action) |
| **audit_logs** | id, actor_id, action, entity_type, entity_id, old_value, new_value, ip, at |
| **cms_pages / banners** | cms_pages(id, slug, title, body, status); banners(id, image_url, link, position, starts_at, ends_at) |
| **site_settings** | key, value, updated_by, updated_at |
| **moderation_queue** | id, item_type, item_id, reason, score, assigned_to, decision, decided_at |
| **support_tickets** | id, user_id, subject, category, priority, status, assigned_to, created_at |
| **fraud_rules / risk_events** | fraud_rules(id, name, condition, action, score); risk_events(id, user_id, event_type, score, details, at) |
| **blacklists / device_fingerprints** | blacklists(id, type, value, reason); device_fingerprints(id, user_id, device_hash, first_seen, last_seen) |
| **strikes** | id, user_id, type, reason, expires_at |
| **outbox** | id, aggregate, event_type, payload (JSONB), created_at, published_at |
| **idempotency_keys** | key, request_hash, response (JSONB), created_at |

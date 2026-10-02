# §5 Data models — Identity & catalog

Money fields: `*_minor` (integer, smallest unit). JSONB noted. All tables: `created_at`, `updated_at`; user tables: `deleted_at` soft delete.

## 5.1 Identity

| Table | Fields |
|-------|--------|
| **users** | id, public_id, username, email, phone, password_hash, account_type, status, seller_level, email_verified_at, phone_verified_at, created_at, updated_at, deleted_at |
| **user_profiles** | user_id, first_name, last_name, display_name, avatar_url, date_of_birth, language, currency, timezone, bio |
| **business_profiles** | user_id, business_name, registration_no, pan_vat_no, business_type, address, website, contact_person |
| **addresses** | id, user_id, label, recipient_name, phone, line1, line2, city, province, postal_code, country, is_default_shipping, is_default_billing |
| **kyc_documents** | id, user_id, doc_type, doc_number (encrypted), front_url, back_url, selfie_url, status, rejection_reason, reviewed_by, reviewed_at |
| **verification_codes** | id, user_id, channel, code_hash, expires_at, attempts, verified_at |
| **auth_sessions** | id, user_id, refresh_token_hash, device, ip, user_agent, last_active_at, revoked_at |
| **two_factor** | user_id, method, secret (encrypted), backup_codes_hash, enabled_at |
| **social_accounts** | id, user_id, provider, provider_user_id, linked_at |
| **account_restrictions** | id, user_id, type, reason, starts_at, ends_at, appeal_status |
| **user_blocks** | blocker_id, blocked_id, reason, created_at |

## 5.2 Catalog

| Table | Fields |
|-------|--------|
| **categories** | id, parent_id, name, slug, level, path, icon_url, sort_order, commission_bp, allow_auction, allow_fixed, allow_offer, requires_approval, is_active, seo_title, seo_description |
| **category_attributes** | id, category_id, name, input_type, is_required, is_filterable, is_searchable, unit, sort_order |
| **attribute_values** | id, attribute_id, value, sort_order |
| **conditions** | id, name, description |
| **brands** | id, name, logo_url, is_verified, is_restricted |
| **restricted_rules** | id, category_id, rule_type, rule_text, requires_documents |

-- Phase 4: returns, disputes, seller tools, RBAC, CMS, trust & safety
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_role TEXT NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_score INT NOT NULL DEFAULT 0;
UPDATE users SET staff_role = 'super_admin' WHERE is_staff = TRUE AND staff_role = 'none';

ALTER TABLE escrow_holds DROP CONSTRAINT IF EXISTS escrow_holds_status_check;
ALTER TABLE escrow_holds ADD CONSTRAINT escrow_holds_status_check
  CHECK (status IN ('held','released','refunded','partial','frozen'));

CREATE TABLE IF NOT EXISTS staff_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);
INSERT INTO staff_roles (id, name, description) VALUES
  ('super_admin', 'Super Admin', 'Full platform access'),
  ('moderator', 'Moderator', 'Listings, users, disputes, trust'),
  ('finance', 'Finance', 'Payouts, refunds, ledger, revenue'),
  ('support', 'Support', 'Tickets, messages, order lookup')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS staff_permissions (
  role_id TEXT NOT NULL REFERENCES staff_roles(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  PRIMARY KEY (role_id, module, action)
);
INSERT INTO staff_permissions (role_id, module, action)
SELECT r, m, a FROM (VALUES
  ('moderator','users','read'), ('moderator','users','write'),
  ('moderator','listings','read'), ('moderator','listings','write'),
  ('moderator','disputes','read'), ('moderator','disputes','write'),
  ('moderator','moderation','read'), ('moderator','moderation','write'),
  ('moderator','trust','read'), ('moderator','trust','write'),
  ('finance','orders','read'), ('finance','payouts','read'), ('finance','payouts','write'),
  ('finance','refunds','read'), ('finance','refunds','write'),
  ('finance','ledger','read'), ('finance','analytics','read'),
  ('support','users','read'), ('support','orders','read'),
  ('support','tickets','read'), ('support','tickets','write'),
  ('support','messages','read'), ('support','messages','write'),
  ('support','disputes','read')
) AS t(r, m, a)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS returns (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id INTEGER REFERENCES order_items(id) ON DELETE SET NULL,
  buyer_id BIGINT NOT NULL REFERENCES users(id),
  seller_id BIGINT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL CHECK (reason IN ('not_as_described','damaged','wrong_item','changed_mind','other')),
  detail TEXT,
  requested_resolution TEXT NOT NULL DEFAULT 'refund' CHECK (requested_resolution IN ('refund','replacement','partial_refund')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested','seller_approved','seller_declined','label_issued','in_transit','received','refunded','closed','escalated'
  )),
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  amount NUMERIC(12,2),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seller_response_due TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 days'),
  decided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS returns_buyer_idx ON returns (buyer_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS returns_seller_idx ON returns (seller_id, status);
CREATE INDEX IF NOT EXISTS returns_order_idx ON returns (order_id);

CREATE TABLE IF NOT EXISTS return_shipments (
  id BIGSERIAL PRIMARY KEY,
  return_id BIGINT NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  carrier TEXT,
  tracking_number TEXT,
  label_code TEXT,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cases (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  return_id BIGINT REFERENCES returns(id) ON DELETE SET NULL,
  buyer_id BIGINT NOT NULL REFERENCES users(id),
  seller_id BIGINT NOT NULL REFERENCES users(id),
  case_type TEXT NOT NULL CHECK (case_type IN ('inr','inad','return','other')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open','awaiting_seller','awaiting_buyer','escalated','resolved','appealed','closed'
  )),
  amount_claimed NUMERIC(12,2),
  freeze_escrow BOOLEAN NOT NULL DEFAULT TRUE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seller_response_due TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 days'),
  escalated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  appeal_used BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS cases_status_idx ON cases (status, seller_response_due);
CREATE INDEX IF NOT EXISTS cases_order_idx ON cases (order_id);

CREATE TABLE IF NOT EXISTS case_messages (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  sender_id BIGINT REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'user',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_evidence (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  uploaded_by BIGINT REFERENCES users(id),
  file_url TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'photo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_decisions (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  decided_by BIGINT REFERENCES users(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('refund_buyer','partial_refund','side_with_seller','return_item')),
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  seller_penalty TEXT,
  reason TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vacation_mode (
  seller_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  message TEXT,
  hide_listings BOOLEAN NOT NULL DEFAULT TRUE,
  auto_reply BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_replies (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  seller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS saved_replies_seller_idx ON saved_replies (seller_id);

CREATE TABLE IF NOT EXISTS cms_pages (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  updated_by BIGINT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_banners (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT,
  link TEXT,
  position TEXT NOT NULL DEFAULT 'home_hero',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by BIGINT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO site_settings (key, value) VALUES
  ('buyer_protection_days', '30'::jsonb),
  ('auction', '{"softCloseMinutes":5,"unpaidHours":48}'::jsonb),
  ('fees', '{"defaultCommission":10,"processingPct":2}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS moderation_queue (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  reason TEXT,
  score INT NOT NULL DEFAULT 0,
  assigned_to BIGINT REFERENCES users(id),
  decision TEXT CHECK (decision IN ('approved','rejected','flagged')),
  decided_by BIGINT REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS moderation_open_idx ON moderation_queue (created_at DESC) WHERE decision IS NULL;

CREATE TABLE IF NOT EXISTS support_tickets (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','assigned','resolved','closed')),
  assigned_to BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON support_tickets (status, created_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id BIGINT REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fraud_rules (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  condition TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'review',
  score INT NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO fraud_rules (name, condition, action, score) VALUES
  ('register_velocity', '3 accounts from same IP in 1 hour', 'review', 25),
  ('listing_velocity', '8 listings in 1 hour', 'review', 20),
  ('bid_velocity', '20 bids in 10 minutes', 'review', 30),
  ('duplicate_contact', 'same email or phone on another account', 'review', 40),
  ('blacklist_hit', 'email, phone, or IP on blacklist', 'block', 100),
  ('prohibited_content', 'listing text matches banned terms', 'flag', 50)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS risk_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS risk_events_user_idx ON risk_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS blacklists (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('email','phone','ip','device')),
  value TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, value)
);

CREATE TABLE IF NOT EXISTS device_fingerprints (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_hash)
);

CREATE TABLE IF NOT EXISTS strikes (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'unpaid' CHECK (kind IN ('unpaid','policy','fraud','shipping')),
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS strikes_user_idx ON strikes (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_reports (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  reporter_id BIGINT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('user','listing','message')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','actioned','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id BIGINT,
  actor_type TEXT NOT NULL DEFAULT 'user',
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS listings_seller_status_idx ON listings (seller_id, status);
CREATE INDEX IF NOT EXISTS orders_buyer_created_idx ON orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

INSERT INTO cms_pages (slug, title, body, status) VALUES
  ('faq', 'Frequently asked questions', 'How bidding, Best Offer, escrow, returns, and payouts work on Nexlo. Buyer protection lasts 30 days after delivery.', 'published'),
  ('buyer-protection', 'Buyer protection', 'Open a return or case within the protection window. Funds stay in escrow until the case is resolved.', 'published'),
  ('selling-guide', 'Selling guide', 'List an item, fulfil orders, print labels, and request payouts from Selling. Vacation mode hides listings and auto-replies to buyers.', 'published'),
  ('returns', 'Returns policy', 'Buyers can request a return for item not as described, damaged, or wrong item. Sellers have 3 days to respond before the case escalates.', 'published')
ON CONFLICT (slug) DO NOTHING;

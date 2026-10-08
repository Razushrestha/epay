-- Phase 3: auctions, offers, shipping, ledger, messaging, notifications, DSR
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users ADD COLUMN IF NOT EXISTS unpaid_strikes INT NOT NULL DEFAULT 0;

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS order_id BIGINT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'buyer_to_seller';
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS item_as_described INT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS communication INT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS shipping_time INT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS shipping_cost INT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS reply TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS reply_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS bids (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  bidder_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  max_amount NUMERIC(12,2) NOT NULL,
  is_proxy BOOLEAN NOT NULL DEFAULT TRUE,
  retracted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bids_listing_idx ON bids (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bids_bidder_idx ON bids (bidder_id);

CREATE TABLE IF NOT EXISTS auction_states (
  listing_id INTEGER PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  high_bidder_id BIGINT REFERENCES users(id),
  high_max NUMERIC(12,2),
  current_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  bid_count INT NOT NULL DEFAULT 0,
  reserve_met BOOLEAN NOT NULL DEFAULT FALSE,
  payment_deadline TIMESTAMPTZ,
  unpaid_at TIMESTAMPTZ,
  winner_order_id INTEGER REFERENCES orders(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS second_chance_offers (
  id BIGSERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  bidder_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offers (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','accepted','declined','countered','expired','auto_accepted','auto_declined'
  )),
  round INT NOT NULL DEFAULT 1,
  parent_id BIGINT REFERENCES offers(id),
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS offers_listing_idx ON offers (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS offers_buyer_idx ON offers (buyer_id);
CREATE INDEX IF NOT EXISTS offers_seller_idx ON offers (seller_id);

CREATE TABLE IF NOT EXISTS shipments (
  id BIGSERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id INTEGER REFERENCES order_items(id) ON DELETE SET NULL,
  seller_id BIGINT NOT NULL REFERENCES users(id),
  carrier TEXT,
  tracking_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','shipped','in_transit','delivered','failed')),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tracking_events (
  id BIGSERIAL PRIMARY KEY,
  shipment_id BIGINT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_policies (
  id BIGSERIAL PRIMARY KEY,
  seller_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  handling_days INT NOT NULL DEFAULT 3,
  free_over NUMERIC(12,2),
  default_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  excluded_regions TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cancellation_requests (
  id BIGSERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  requested_by BIGINT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('buyer','seller','staff')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('asset','liability','equity','revenue','expense')),
  user_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  txn_id BIGINT NOT NULL REFERENCES ledger_transactions(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES ledger_accounts(id),
  debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE TABLE IF NOT EXISTS escrow_holds (
  id BIGSERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held','released','refunded','partial')),
  held_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS order_fees (
  id BIGSERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_value_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  insertion_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  processing_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_to_seller NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seller_wallets (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  available_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  lifetime_earnings NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payout_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('bank','esewa','khalti')),
  label TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payouts (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','rejected')),
  account_snapshot JSONB,
  admin_note TEXT,
  paid_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS refunds (
  id BIGSERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  buyer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_thread_idx
  ON conversations (buyer_id, seller_id, (COALESCE(listing_id, 0)));

ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_seller_id_buyer_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS feedback_order_direction_idx
  ON feedback (order_id, direction) WHERE order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS increment_rules (
  min_price NUMERIC(12,2) NOT NULL,
  max_price NUMERIC(12,2) NOT NULL,
  increment_amount NUMERIC(12,2) NOT NULL,
  UNIQUE (min_price, max_price)
);
INSERT INTO increment_rules (min_price, max_price, increment_amount) VALUES
  (0, 1000, 50),
  (1000, 5000, 100),
  (5000, 10000, 250),
  (10000, 25000, 500),
  (25000, 100000, 1000),
  (100000, 999999999, 2500)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS notification_templates (
  type TEXT PRIMARY KEY,
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL
);
INSERT INTO notification_templates (type, email_subject, email_body) VALUES
  ('bid', 'New bid on your listing', 'Someone placed a bid.'),
  ('outbid', 'You were outbid', 'Place a higher max bid to take the lead.'),
  ('won', 'You won the auction', 'Pay within 48 hours to complete your purchase.'),
  ('offer', 'New Best Offer', 'A buyer sent an offer on your listing.'),
  ('message', 'New message', 'You have a new message on Nexlo.'),
  ('shipped', 'Your order shipped', 'Tracking details are in your orders.'),
  ('order_paid', 'Payment confirmed', 'Funds are held in escrow until delivery.')
ON CONFLICT (type) DO NOTHING;

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  attachment_url TEXT,
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_convo_idx ON messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  href TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours TEXT,
  events JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS seller_metrics (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  defect_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  late_shipment_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  cancellation_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  avg_response_hours NUMERIC(8,2),
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ledger_accounts (code, name, kind) VALUES
  ('PLATFORM_CASH', 'Platform cash / gateway', 'asset'),
  ('PLATFORM_ESCROW', 'Buyer escrow', 'liability'),
  ('PLATFORM_REVENUE', 'Platform fees revenue', 'revenue'),
  ('PLATFORM_REFUNDS', 'Refunds expense', 'expense')
ON CONFLICT (code) DO NOTHING;

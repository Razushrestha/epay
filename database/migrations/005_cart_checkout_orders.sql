-- Migration 005: Cart, Checkout, Orders, Payments
-- Multi-seller cart, stock reservations, coupons, orders, payment processing

-- Shopping cart (guest and logged-in users)
CREATE TABLE cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(100), -- For guest users
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  variation_sku_id INTEGER REFERENCES listing_variation_skus(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_snapshot NUMERIC(12,2) NOT NULL, -- Price at time of add-to-cart
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT cart_user_or_session CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE INDEX idx_cart_items_user ON cart_items(user_id);
CREATE INDEX idx_cart_items_session ON cart_items(session_id);
CREATE INDEX idx_cart_items_listing ON cart_items(listing_id);
CREATE INDEX idx_cart_items_added ON cart_items(added_at);

-- Coupons and discount codes
CREATE TABLE coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('percent', 'fixed_amount', 'free_shipping')),
  value NUMERIC(10,2) NOT NULL, -- Percentage (0-100) or fixed amount
  min_purchase NUMERIC(12,2), -- Minimum order value to use coupon
  max_discount NUMERIC(10,2), -- Max discount for percent coupons
  usage_limit INTEGER, -- Total uses allowed (null = unlimited)
  usage_count INTEGER DEFAULT 0,
  usage_per_user INTEGER DEFAULT 1, -- How many times each user can use it
  category_id INTEGER REFERENCES categories(id), -- Restrict to category
  seller_id INTEGER REFERENCES users(id), -- Restrict to specific seller
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(is_active, expires_at);

-- Tax rules (VAT by category or flat rate)
CREATE TABLE tax_rules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('vat', 'sales_tax')),
  rate NUMERIC(5,2) NOT NULL CHECK (rate >= 0 AND rate <= 100), -- Percentage
  category_id INTEGER REFERENCES categories(id), -- Apply to specific category
  country_code CHAR(2) DEFAULT 'NP',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tax_rules_category ON tax_rules(category_id);
CREATE INDEX idx_tax_rules_active ON tax_rules(is_active);

-- Shipping rates (by seller location, weight, or flat)
CREATE TABLE shipping_rates (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('flat', 'weight_based', 'free')),
  base_rate NUMERIC(10,2) DEFAULT 0,
  per_kg_rate NUMERIC(10,2), -- For weight-based
  free_above_amount NUMERIC(12,2), -- Free shipping if order > this amount
  min_weight_kg NUMERIC(8,2),
  max_weight_kg NUMERIC(8,2),
  delivery_days_min INTEGER,
  delivery_days_max INTEGER,
  is_international BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shipping_rates_seller ON shipping_rates(seller_id);
CREATE INDEX idx_shipping_rates_active ON shipping_rates(is_active);

-- Orders table
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(20) UNIQUE NOT NULL, -- e.g., ORD-2026-000001
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment', 'paid', 'processing', 'shipped', 'delivered', 
    'completed', 'cancelled', 'refunded'
  )),
  
  -- Amounts
  subtotal NUMERIC(12,2) NOT NULL,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  shipping_amount NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL,
  
  -- Coupon
  coupon_id INTEGER REFERENCES coupons(id),
  coupon_code VARCHAR(50),
  
  -- Shipping address
  shipping_address_id INTEGER REFERENCES addresses(id),
  shipping_name VARCHAR(100),
  shipping_phone VARCHAR(20),
  shipping_address_line1 VARCHAR(255),
  shipping_address_line2 VARCHAR(255),
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(100),
  shipping_postal_code VARCHAR(20),
  shipping_country VARCHAR(100) DEFAULT 'Nepal',
  
  -- Billing address (if different)
  billing_address_id INTEGER REFERENCES addresses(id),
  
  -- Notes
  buyer_notes TEXT,
  admin_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Cancellation
  cancelled_by INTEGER REFERENCES users(id),
  cancellation_reason TEXT
);

CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- Order items (line items per seller)
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  variation_sku_id INTEGER REFERENCES listing_variation_skus(id) ON DELETE RESTRICT,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Snapshot at purchase time (immutable)
  title VARCHAR(255) NOT NULL,
  sku VARCHAR(50),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL, -- price * quantity
  tax_amount NUMERIC(12,2) DEFAULT 0,
  shipping_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL,
  
  -- Item-level status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'
  )),
  
  -- Shipping
  tracking_number VARCHAR(100),
  carrier VARCHAR(50),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_seller ON order_items(seller_id);
CREATE INDEX idx_order_items_listing ON order_items(listing_id);
CREATE INDEX idx_order_items_status ON order_items(status);

-- Payments table
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Payment gateway
  gateway VARCHAR(50) NOT NULL, -- 'esewa', 'khalti', 'bank_transfer'
  gateway_transaction_id VARCHAR(255), -- External payment ID
  
  -- Amount
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NPR',
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'
  )),
  
  -- Payment method
  payment_method VARCHAR(50), -- 'wallet', 'card', 'bank'
  
  -- Gateway response
  gateway_response JSONB, -- Raw response from gateway
  
  -- Timestamps
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  
  -- Failure details
  failure_reason TEXT,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_gateway_txn ON payments(gateway_transaction_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Payment webhooks (for idempotency and debugging)
CREATE TABLE payment_webhooks (
  id SERIAL PRIMARY KEY,
  gateway VARCHAR(50) NOT NULL,
  event_type VARCHAR(50),
  event_id VARCHAR(255), -- Gateway's event ID for deduplication
  payload JSONB NOT NULL,
  signature VARCHAR(500), -- For verification
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gateway, event_id)
);

CREATE INDEX idx_payment_webhooks_gateway ON payment_webhooks(gateway);
CREATE INDEX idx_payment_webhooks_processed ON payment_webhooks(processed);
CREATE INDEX idx_payment_webhooks_received ON payment_webhooks(received_at);

-- Order history/audit log
CREATE TABLE order_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status_from VARCHAR(20),
  status_to VARCHAR(20),
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_history_order ON order_history(order_id);

-- Stock reservations (15-minute hold during checkout)
-- Placed after orders table to avoid forward reference
CREATE TABLE stock_reservations (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  variation_sku_id INTEGER REFERENCES listing_variation_skus(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reserved_by_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reserved_by_session_id VARCHAR(100),
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE, -- Set when order is created
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT reservation_user_or_session CHECK (reserved_by_user_id IS NOT NULL OR reserved_by_session_id IS NOT NULL)
);

CREATE INDEX idx_stock_reservations_listing ON stock_reservations(listing_id);
CREATE INDEX idx_stock_reservations_expires ON stock_reservations(expires_at);
CREATE INDEX idx_stock_reservations_user ON stock_reservations(reserved_by_user_id);
CREATE INDEX idx_stock_reservations_order ON stock_reservations(order_id);

-- Coupon usage tracking (placed after orders table)
CREATE TABLE coupon_usages (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_amount NUMERIC(10,2) NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coupon_usages_coupon ON coupon_usages(coupon_id);
CREATE INDEX idx_coupon_usages_user ON coupon_usages(user_id);
CREATE INDEX idx_coupon_usages_order ON coupon_usages(order_id);

-- Insert default tax rule (13% VAT for Nepal)
INSERT INTO tax_rules (name, type, rate, is_active) VALUES
  ('Nepal VAT', 'vat', 13.00, true)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE cart_items IS 'Shopping cart for logged-in and guest users';
COMMENT ON TABLE stock_reservations IS '15-minute hold on inventory during checkout';
COMMENT ON TABLE coupons IS 'Discount codes and promotions';
COMMENT ON TABLE orders IS 'Customer orders with multi-seller support';
COMMENT ON TABLE order_items IS 'Line items per seller in an order';
COMMENT ON TABLE payments IS 'Payment transactions with gateway integration';
COMMENT ON TABLE payment_webhooks IS 'Payment gateway webhook events for idempotency';

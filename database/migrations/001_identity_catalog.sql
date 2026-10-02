-- Nexlo M1: identity + catalog (proposal §5.1, §5.2)

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT,
  account_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (account_type IN ('individual', 'business')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'restricted', 'suspended')),
  seller_level TEXT NOT NULL DEFAULT 'new'
    CHECK (seller_level IN ('new', 'standard', 'above_standard', 'top_rated')),
  email_verified_at TIMESTAMPTZ,
  phone_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE user_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  date_of_birth DATE,
  language TEXT NOT NULL DEFAULT 'en',
  currency TEXT NOT NULL DEFAULT 'NPR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kathmandu',
  bio TEXT
);

CREATE TABLE categories (
  id BIGSERIAL PRIMARY KEY,
  parent_id BIGINT REFERENCES categories (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  level INT NOT NULL DEFAULT 0,
  path TEXT NOT NULL DEFAULT '',
  icon_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  commission_bp INT NOT NULL DEFAULT 0,
  allow_auction BOOLEAN NOT NULL DEFAULT TRUE,
  allow_fixed BOOLEAN NOT NULL DEFAULT TRUE,
  allow_offer BOOLEAN NOT NULL DEFAULT TRUE,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX categories_parent_id_idx ON categories (parent_id);
CREATE INDEX categories_active_sort_idx ON categories (is_active, sort_order);

CREATE TABLE category_attributes (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  input_type TEXT NOT NULL
    CHECK (input_type IN ('text', 'dropdown', 'multi_select', 'number', 'date', 'yes_no')),
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_filterable BOOLEAN NOT NULL DEFAULT FALSE,
  is_searchable BOOLEAN NOT NULL DEFAULT FALSE,
  unit TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE attribute_values (
  id BIGSERIAL PRIMARY KEY,
  attribute_id BIGINT NOT NULL REFERENCES category_attributes (id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE conditions (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE kyc_documents (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  doc_number_encrypted TEXT,
  front_url TEXT,
  back_url TEXT,
  selfie_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by BIGINT REFERENCES users (id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE verification_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users (id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'phone')),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE outbox (
  id BIGSERIAL PRIMARY KEY,
  aggregate TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX outbox_unpublished_idx ON outbox (created_at) WHERE published_at IS NULL;

INSERT INTO conditions (name, description) VALUES
  ('new', 'Brand new, unused'),
  ('used', 'Previously used'),
  ('refurbished', 'Restored to working order'),
  ('for_parts', 'For parts or not working');

INSERT INTO categories (name, slug, level, path, sort_order) VALUES
  ('Electronics', 'electronics', 0, 'electronics', 10),
  ('Fashion', 'fashion', 0, 'fashion', 20),
  ('Home & Garden', 'home-garden', 0, 'home-garden', 30),
  ('Collectibles', 'collectibles', 0, 'collectibles', 40);

INSERT INTO categories (parent_id, name, slug, level, path, sort_order)
SELECT c.id, 'Mobile Phones', 'mobile-phones', 1, 'electronics/mobile-phones', 1
FROM categories c WHERE c.slug = 'electronics';

INSERT INTO categories (parent_id, name, slug, level, path, sort_order)
SELECT c.id, 'Laptops', 'laptops', 1, 'electronics/laptops', 2
FROM categories c WHERE c.slug = 'electronics';

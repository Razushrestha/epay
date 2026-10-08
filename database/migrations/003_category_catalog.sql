-- Migration 003: Category Catalog System
-- Hierarchical categories, item specifics, conditions, brands, and restrictions

-- Drop existing tables if they exist (clean migration)
DROP TABLE IF EXISTS category_audit_log CASCADE;
DROP TABLE IF EXISTS featured_categories CASCADE;
DROP TABLE IF EXISTS category_fees CASCADE;
DROP TABLE IF EXISTS restricted_items CASCADE;
DROP TABLE IF EXISTS category_specifics CASCADE;
DROP TABLE IF EXISTS item_specific_options CASCADE;
DROP TABLE IF EXISTS item_specifics CASCADE;
DROP TABLE IF EXISTS category_conditions CASCADE;
DROP TABLE IF EXISTS conditions CASCADE;
DROP TABLE IF EXISTS brands CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- Categories table with nested set model for efficient hierarchy queries
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 3), -- L1, L2, L3
  lft INTEGER NOT NULL,
  rgt INTEGER NOT NULL,
  icon VARCHAR(50), -- Icon identifier
  image_url TEXT,
  description TEXT,
  item_count INTEGER DEFAULT 0,
  is_restricted BOOLEAN DEFAULT FALSE,
  requires_approval BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (rgt > lft)
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_lft_rgt ON categories(lft, rgt);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_active ON categories(is_active);

-- Condition types (New, Used, Refurbished, etc.)
CREATE TABLE conditions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(60) UNIQUE NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Category-specific conditions (some categories may not allow certain conditions)
CREATE TABLE category_conditions (
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  condition_id INTEGER REFERENCES conditions(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (category_id, condition_id)
);

-- Brands
CREATE TABLE brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(120) UNIQUE NOT NULL,
  logo_url TEXT,
  description TEXT,
  website VARCHAR(255),
  is_verified BOOLEAN DEFAULT FALSE,
  listing_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brands_slug ON brands(slug);
CREATE INDEX idx_brands_verified ON brands(is_verified);

-- Item specifics (attributes) definition
CREATE TABLE item_specifics (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  input_type VARCHAR(20) NOT NULL CHECK (input_type IN ('text', 'number', 'select', 'multiselect', 'date', 'boolean')),
  unit VARCHAR(20), -- kg, cm, watts, etc.
  is_required BOOLEAN DEFAULT FALSE,
  is_variant BOOLEAN DEFAULT FALSE, -- Can this be used for product variations?
  help_text TEXT,
  validation_regex VARCHAR(255),
  min_value NUMERIC,
  max_value NUMERIC,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_item_specifics_slug ON item_specifics(slug);

-- Predefined options for select/multiselect specifics
CREATE TABLE item_specific_options (
  id SERIAL PRIMARY KEY,
  specific_id INTEGER REFERENCES item_specifics(id) ON DELETE CASCADE,
  value VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_specific_options_specific ON item_specific_options(specific_id);

-- Category item specifics mapping
CREATE TABLE category_specifics (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  specific_id INTEGER REFERENCES item_specifics(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, specific_id)
);

CREATE INDEX idx_category_specifics_category ON category_specifics(category_id);
CREATE INDEX idx_category_specifics_specific ON category_specifics(specific_id);

-- Restricted items and prohibited keywords
CREATE TABLE restricted_items (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  keywords TEXT[], -- Array of prohibited keywords
  rule_type VARCHAR(20) CHECK (rule_type IN ('prohibited', 'restricted', 'requires_permit')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_restricted_items_category ON restricted_items(category_id);
CREATE INDEX idx_restricted_keywords ON restricted_items USING GIN(keywords);

-- Commission and fee rules per category
CREATE TABLE category_fees (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE UNIQUE,
  commission_percentage NUMERIC(5,2) DEFAULT 10.00 CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  insertion_fee NUMERIC(10,2) DEFAULT 0,
  final_value_fee_percentage NUMERIC(5,2) DEFAULT 0 CHECK (final_value_fee_percentage >= 0),
  auction_listing_fee NUMERIC(10,2) DEFAULT 0,
  featured_listing_fee NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_category_fees_category ON category_fees(category_id);

-- Featured categories for homepage
CREATE TABLE featured_categories (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE UNIQUE,
  title VARCHAR(100),
  subtitle VARCHAR(200),
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for category changes
CREATE TABLE category_audit_log (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL, -- created, updated, deleted, activated, deactivated
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changes JSONB, -- What changed
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_category_audit_category ON category_audit_log(category_id);
CREATE INDEX idx_category_audit_created ON category_audit_log(created_at);

-- Insert default conditions
INSERT INTO conditions (name, slug, description, sort_order) VALUES
  ('New', 'new', 'Brand new, unused item in original packaging', 1),
  ('Like New', 'like-new', 'Barely used with no signs of wear', 2),
  ('Excellent', 'excellent', 'Very lightly used with minimal wear', 3),
  ('Very Good', 'very-good', 'Lightly used with minor imperfections', 4),
  ('Good', 'good', 'Used with noticeable signs of wear', 5),
  ('Acceptable', 'acceptable', 'Heavily used but still functional', 6),
  ('For Parts', 'for-parts', 'Not working or missing parts', 7),
  ('Refurbished', 'refurbished', 'Professionally restored to working condition', 8)
ON CONFLICT (slug) DO NOTHING;

-- Sample root categories (to be expanded by admin)
INSERT INTO categories (name, slug, parent_id, level, lft, rgt, icon, sort_order) VALUES
  ('Electronics', 'electronics', NULL, 1, 1, 2, '⚡', 1),
  ('Fashion', 'fashion', NULL, 1, 3, 4, '👔', 2),
  ('Home & Garden', 'home-garden', NULL, 1, 5, 6, '🏠', 3),
  ('Sports & Outdoors', 'sports-outdoors', NULL, 1, 7, 8, '⚽', 4),
  ('Automotive', 'automotive', NULL, 1, 9, 10, '🚗', 5),
  ('Books & Media', 'books-media', NULL, 1, 11, 12, '📚', 6),
  ('Toys & Hobbies', 'toys-hobbies', NULL, 1, 13, 14, '🎮', 7),
  ('Health & Beauty', 'health-beauty', NULL, 1, 15, 16, '💄', 8),
  ('Jewelry & Watches', 'jewelry-watches', NULL, 1, 17, 18, '💎', 9),
  ('Art & Collectibles', 'art-collectibles', NULL, 1, 19, 20, '🎨', 10)
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE categories IS 'Hierarchical category tree using nested set model';
COMMENT ON TABLE conditions IS 'Item condition types (New, Used, etc.)';
COMMENT ON TABLE brands IS 'Product brands/manufacturers';
COMMENT ON TABLE item_specifics IS 'Custom attributes for categories (color, size, etc.)';
COMMENT ON TABLE restricted_items IS 'Prohibited or restricted items per category';
COMMENT ON TABLE category_fees IS 'Commission and listing fees per category';

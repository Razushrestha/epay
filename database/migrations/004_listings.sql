-- Migration 004: Listings and Inventory System
-- Fixed price listings, auction listings, variations, photos, drafts, scheduling

-- Main listings table
CREATE TABLE listings (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  brand_id INTEGER REFERENCES brands(id),
  
  -- Basic info
  title VARCHAR(80) NOT NULL,
  subtitle VARCHAR(55),
  description TEXT NOT NULL,
  condition_id INTEGER REFERENCES conditions(id),
  condition_description TEXT,
  
  -- Format and pricing
  format VARCHAR(20) NOT NULL CHECK (format IN ('fixed', 'auction', 'both')),
  price NUMERIC(12,2), -- Fixed price or Buy It Now price
  quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),
  
  -- Auction-specific
  auction_start_price NUMERIC(12,2),
  auction_reserve_price NUMERIC(12,2),
  auction_buy_now_price NUMERIC(12,2),
  auction_duration INTEGER, -- hours
  auction_starts_at TIMESTAMPTZ,
  auction_ends_at TIMESTAMPTZ,
  auction_bid_count INTEGER DEFAULT 0,
  auction_current_price NUMERIC(12,2),
  auction_winner_id INTEGER REFERENCES users(id),
  
  -- Best Offer
  allow_best_offer BOOLEAN DEFAULT FALSE,
  auto_accept_price NUMERIC(12,2),
  auto_decline_price NUMERIC(12,2),
  
  -- Shipping
  shipping_free BOOLEAN DEFAULT FALSE,
  shipping_cost NUMERIC(10,2),
  shipping_additional NUMERIC(10,2),
  shipping_international BOOLEAN DEFAULT FALSE,
  shipping_international_cost NUMERIC(10,2),
  handling_time_days INTEGER DEFAULT 3,
  
  -- Location
  item_location VARCHAR(100),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  
  -- Item specifics (custom attributes)
  specifics JSONB DEFAULT '{}',
  
  -- SKU and UPC
  sku VARCHAR(50),
  upc VARCHAR(50),
  
  -- Status and moderation
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'sold', 'ended', 'removed', 'suspended')),
  is_featured BOOLEAN DEFAULT FALSE,
  is_promoted BOOLEAN DEFAULT FALSE,
  publish_at TIMESTAMPTZ,
  
  -- Counters
  view_count INTEGER DEFAULT 0,
  watch_count INTEGER DEFAULT 0,
  question_count INTEGER DEFAULT 0,
  
  -- Moderation
  moderation_status VARCHAR(20) DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
  moderation_reason TEXT,
  moderated_by INTEGER REFERENCES users(id),
  moderated_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_listings_seller ON listings(seller_id);
CREATE INDEX idx_listings_category ON listings(category_id);
CREATE INDEX idx_listings_brand ON listings(brand_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_format ON listings(format);
CREATE INDEX idx_listings_price ON listings(price);
CREATE INDEX idx_listings_created ON listings(created_at DESC);
CREATE INDEX idx_listings_published ON listings(published_at DESC);
CREATE INDEX idx_listings_auction_ends ON listings(auction_ends_at);
CREATE INDEX idx_listings_moderation ON listings(moderation_status);
CREATE INDEX idx_listings_specifics ON listings USING GIN(specifics);
CREATE INDEX idx_listings_location ON listings(latitude, longitude);
CREATE INDEX idx_listings_search ON listings USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Listing photos
CREATE TABLE listing_photos (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  position INTEGER DEFAULT 0,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  is_primary BOOLEAN DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listing_photos_listing ON listing_photos(listing_id);
CREATE INDEX idx_listing_photos_position ON listing_photos(listing_id, position);

-- Listing variations (e.g., Size, Color)
CREATE TABLE listing_variations (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL, -- e.g., "Size", "Color"
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listing_variations_listing ON listing_variations(listing_id);

-- Variation options (e.g., "Small", "Medium", "Large" for Size)
CREATE TABLE listing_variation_options (
  id SERIAL PRIMARY KEY,
  variation_id INTEGER NOT NULL REFERENCES listing_variations(id) ON DELETE CASCADE,
  value VARCHAR(50) NOT NULL, -- e.g., "Small", "Red"
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_variation_options_variation ON listing_variation_options(variation_id);

-- Variation combinations (SKUs) with stock and price
CREATE TABLE listing_variation_skus (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  sku VARCHAR(50),
  combination JSONB NOT NULL, -- e.g., {"Size": "Large", "Color": "Red"}
  price NUMERIC(12,2),
  quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_variation_skus_listing ON listing_variation_skus(listing_id);
CREATE INDEX idx_variation_skus_sku ON listing_variation_skus(sku);
CREATE INDEX idx_variation_skus_combination ON listing_variation_skus USING GIN(combination);

-- Listing drafts history (auto-save)
CREATE TABLE listing_drafts (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  draft_data JSONB NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listing_drafts_listing ON listing_drafts(listing_id);
CREATE INDEX idx_listing_drafts_seller ON listing_drafts(seller_id);

-- Watchlist
CREATE TABLE watchlist (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX idx_watchlist_user ON watchlist(user_id);
CREATE INDEX idx_watchlist_listing ON watchlist(listing_id);

-- Listing views (for analytics)
CREATE TABLE listing_views (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listing_views_listing ON listing_views(listing_id);
CREATE INDEX idx_listing_views_user ON listing_views(user_id);
CREATE INDEX idx_listing_views_session ON listing_views(session_id);
CREATE INDEX idx_listing_views_date ON listing_views(viewed_at);

-- Listing questions (buyer-seller Q&A)
CREATE TABLE listing_questions (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  asker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  answered_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);

CREATE INDEX idx_listing_questions_listing ON listing_questions(listing_id);
CREATE INDEX idx_listing_questions_asker ON listing_questions(asker_id);

-- Listing reports/flags
CREATE TABLE listing_reports (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listing_reports_listing ON listing_reports(listing_id);
CREATE INDEX idx_listing_reports_status ON listing_reports(status);

-- Saved searches
CREATE TABLE saved_searches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  query_params JSONB NOT NULL,
  notify_new_listings BOOLEAN DEFAULT TRUE,
  notify_price_drops BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ
);

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);

-- Recently viewed items
CREATE TABLE recently_viewed (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX idx_recently_viewed_user ON recently_viewed(user_id, viewed_at DESC);

-- Listing performance metrics (seller analytics)
CREATE TABLE listing_metrics (
  listing_id INTEGER PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  watches INTEGER DEFAULT 0,
  cart_adds INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  revenue NUMERIC(12,2) DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,
  avg_time_on_page INTEGER DEFAULT 0, -- seconds
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listing_metrics_revenue ON listing_metrics(revenue DESC);
CREATE INDEX idx_listing_metrics_conversion ON listing_metrics(conversion_rate DESC);

-- Bulk upload batches
CREATE TABLE bulk_upload_batches (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255),
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  errors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_bulk_upload_seller ON bulk_upload_batches(seller_id);

COMMENT ON TABLE listings IS 'Main listings table supporting fixed price, auctions, and variations';
COMMENT ON TABLE listing_photos IS 'Listing photos with position ordering';
COMMENT ON TABLE listing_variations IS 'Variation types (Size, Color, etc.)';
COMMENT ON TABLE listing_variation_options IS 'Variation options (Small, Red, etc.)';
COMMENT ON TABLE listing_variation_skus IS 'Variation combinations with individual pricing and stock';
COMMENT ON TABLE watchlist IS 'User watchlist for tracking interesting items';
COMMENT ON TABLE listing_questions IS 'Buyer-seller Q&A on listings';
COMMENT ON TABLE listing_reports IS 'User reports for inappropriate listings';
COMMENT ON TABLE saved_searches IS 'User saved searches with email notifications';
COMMENT ON TABLE listing_metrics IS 'Seller analytics and performance metrics';

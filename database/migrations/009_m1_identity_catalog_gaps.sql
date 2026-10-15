-- M1 gaps vs ebay.com: consents, KYC access logs, collections, Apple/Facebook login

CREATE TABLE IF NOT EXISTS user_consents (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  policy TEXT NOT NULL CHECK (policy IN ('privacy', 'terms', 'cookies')),
  version TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, policy, version)
);

CREATE INDEX IF NOT EXISTS user_consents_user_idx ON user_consents (user_id, policy);

CREATE TABLE IF NOT EXISTS kyc_access_logs (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES kyc_documents (id) ON DELETE CASCADE,
  viewer_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kyc_access_logs_doc_idx ON kyc_access_logs (document_id, created_at DESC);

CREATE TABLE IF NOT EXISTS collections (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS collections_user_idx ON collections (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id BIGINT NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, listing_id)
);

CREATE TABLE IF NOT EXISTS seller_follows (
  follower_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  seller_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, seller_id)
);

ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_provider_check;
ALTER TABLE social_accounts ADD CONSTRAINT social_accounts_provider_check
  CHECK (provider IN ('google', 'apple', 'facebook'));

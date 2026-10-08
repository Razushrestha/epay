-- Account management: sessions, 2FA, addresses, feedback, standing, Google link

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_seller BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_staff BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS buyer_only BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'verify';
ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS destination TEXT;

CREATE TABLE IF NOT EXISTS social_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google')),
  provider_user_id TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS business_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  registration_country TEXT,
  tax_id TEXT,
  website TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addresses (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  label TEXT,
  full_name TEXT NOT NULL,
  phone TEXT,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  region TEXT,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'Nepal',
  is_default_shipping BOOLEAN NOT NULL DEFAULT FALSE,
  is_default_billing BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS addresses_user_idx ON addresses (user_id);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip TEXT,
  remember BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id BIGSERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS two_factor (
  user_id BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('otp', 'authenticator')),
  secret TEXT,
  enabled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE,
  seller_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  buyer_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'neutral', 'negative')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (seller_id, buyer_id)
);

CREATE TABLE IF NOT EXISTS feedback_scores (
  user_id BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  positive_count INT NOT NULL DEFAULT 0,
  neutral_count INT NOT NULL DEFAULT 0,
  negative_count INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS account_actions (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('restrict', 'suspend', 'restore')),
  reason TEXT NOT NULL,
  until_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS public_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS kyc_documents_public_id_idx ON kyc_documents (public_id);

CREATE TABLE IF NOT EXISTS appeals (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  action_id BIGINT REFERENCES account_actions (id),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'upheld', 'overturned')),
  resolution TEXT,
  reviewed_by BIGINT REFERENCES users (id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

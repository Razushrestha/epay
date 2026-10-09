-- Architecture gaps: blocked bidders, synonyms, tax/shipping seeds, recon, idempotency

CREATE TABLE IF NOT EXISTS blocked_bidders (
  seller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (seller_id, blocked_user_id)
);

CREATE TABLE IF NOT EXISTS search_synonyms (
  term TEXT PRIMARY KEY,
  synonyms TEXT[] NOT NULL DEFAULT '{}'
);
INSERT INTO search_synonyms (term, synonyms) VALUES
  ('phone', ARRAY['mobile','smartphone','cell']),
  ('laptop', ARRAY['notebook','macbook']),
  ('tv', ARRAY['television','smart tv'])
ON CONFLICT (term) DO NOTHING;

CREATE TABLE IF NOT EXISTS gateway_reconcile_runs (
  id BIGSERIAL PRIMARY KEY,
  gateway TEXT NOT NULL,
  payments_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  ledger_cash NUMERIC(14,2) NOT NULL DEFAULT 0,
  unmatched INTEGER NOT NULL DEFAULT 0,
  balanced BOOLEAN NOT NULL DEFAULT FALSE,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  request_hash TEXT,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tax_rules (name, type, rate, category_id, country_code, is_active)
SELECT 'Nepal VAT 13%', 'vat', 13, NULL, 'NP', TRUE
WHERE NOT EXISTS (SELECT 1 FROM tax_rules WHERE is_active = TRUE);

INSERT INTO shipping_rates (seller_id, name, type, base_rate, free_above_amount, is_active)
SELECT NULL, 'Platform default', 'flat', 150, 5000, TRUE
WHERE NOT EXISTS (SELECT 1 FROM shipping_rates WHERE seller_id IS NULL AND is_active = TRUE);

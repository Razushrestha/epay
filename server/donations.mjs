import { query } from "./db.mjs";

const CHARITIES = [
  {
    slug: "nepal-red-cross",
    name: "Nepal Red Cross Society",
    blurb: "Disaster relief, blood service, and first aid across Nepal.",
  },
  {
    slug: "teach-for-nepal",
    name: "Teach For Nepal",
    blurb: "Fellows teaching in under-served government schools.",
  },
  {
    slug: "tewa",
    name: "Tewa",
    blurb: "A Nepal women’s fund that supports community philanthropy.",
  },
];

let ready;

export function ensureDonationTables() {
  if (!ready) {
    ready = createDonationTables().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

async function createDonationTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS charities (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      blurb TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS user_donation_prefs (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      charity_id INTEGER REFERENCES charities(id),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS donation_amount NUMERIC(12,2) NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS donation_charity_id INTEGER REFERENCES charities(id)`);
  for (const charity of CHARITIES) {
    await query(
      `INSERT INTO charities (slug, name, blurb) VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, blurb = EXCLUDED.blurb`,
      [charity.slug, charity.name, charity.blurb],
    );
  }
}

export function roundUpDonation(total) {
  const amount = Number(total);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const step = 10;
  const extra = +(Math.ceil(amount / step) * step - amount).toFixed(2);
  return extra < 0.01 ? step : extra;
}

export async function listCharities() {
  await ensureDonationTables();
  const { rows } = await query(
    `SELECT id, slug, name, blurb FROM charities WHERE is_active = TRUE ORDER BY id`,
  );
  return rows;
}

export async function getDonationAccount(userId) {
  await ensureDonationTables();
  const charities = await listCharities();
  if (!userId) return { prefs: { enabled: false, charity_id: charities[0]?.id ?? null }, charities };
  const { rows } = await query(
    `SELECT enabled, charity_id FROM user_donation_prefs WHERE user_id = $1`,
    [userId],
  );
  return {
    prefs: {
      enabled: Boolean(rows[0]?.enabled),
      charity_id: rows[0]?.charity_id || charities[0]?.id || null,
    },
    charities,
  };
}

export async function saveDonationPrefs(userId, body) {
  await ensureDonationTables();
  const charities = await listCharities();
  const charityId = Number(body.charityId || body.charity_id || charities[0]?.id);
  if (!charities.some((row) => Number(row.id) === charityId)) {
    const err = new Error("Choose a listed charity");
    err.status = 400;
    throw err;
  }
  const enabled = Boolean(body.enabled);
  await query(
    `INSERT INTO user_donation_prefs (user_id, enabled, charity_id, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE SET enabled = EXCLUDED.enabled, charity_id = EXCLUDED.charity_id, updated_at = NOW()`,
    [userId, enabled, charityId],
  );
  return getDonationAccount(userId);
}

export async function donationForCheckout(userId, donateFlag, merchandiseTotal) {
  await ensureDonationTables();
  const account = await getDonationAccount(userId);
  const wantDonate = donateFlag == null ? account.prefs.enabled : Boolean(donateFlag);
  if (!wantDonate || !userId) {
    return { amount: 0, charity: null };
  }
  const charity = account.charities.find((row) => Number(row.id) === Number(account.prefs.charity_id)) || account.charities[0];
  return {
    amount: roundUpDonation(merchandiseTotal),
    charity,
  };
}

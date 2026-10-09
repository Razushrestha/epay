import { query } from "./db.mjs";

export const DEFAULT_INCREMENTS = [
  { min_price: 0, max_price: 1000, increment_amount: 50 },
  { min_price: 1000, max_price: 5000, increment_amount: 100 },
  { min_price: 5000, max_price: 10000, increment_amount: 250 },
  { min_price: 10000, max_price: 25000, increment_amount: 500 },
  { min_price: 25000, max_price: 100000, increment_amount: 1000 },
  { min_price: 100000, max_price: 999999999, increment_amount: 2500 },
];

export function incrementFromRules(price, rules = DEFAULT_INCREMENTS) {
  const n = Number(price) || 0;
  const hit = rules.find((r) => n >= Number(r.min_price) && n < Number(r.max_price));
  return Number(hit?.increment_amount || 2500);
}

let cachedRules = null;
let cachedAt = 0;

export async function loadIncrementRules() {
  if (cachedRules && Date.now() - cachedAt < 60_000) return cachedRules;
  try {
    const { rows } = await query(
      `SELECT min_price, max_price, increment_amount FROM increment_rules ORDER BY min_price`,
    );
    cachedRules = rows.length ? rows : DEFAULT_INCREMENTS;
    cachedAt = Date.now();
    return cachedRules;
  } catch {
    return DEFAULT_INCREMENTS;
  }
}

export async function incrementFor(price) {
  return incrementFromRules(price, await loadIncrementRules());
}

export function taxAmount(subtotal, ratePercent) {
  const amount = Number(subtotal) || 0;
  const rate = Number(ratePercent);
  const pct = Number.isFinite(rate) ? rate : 13;
  return +(amount * (pct / 100)).toFixed(2);
}

export function shippingFromRate(rate, sellerSubtotal, listingFallback = 0) {
  if (!rate) return Number(listingFallback) || 0;
  const sub = Number(sellerSubtotal) || 0;
  if (rate.type === "free") return 0;
  if (rate.free_above_amount && sub >= Number(rate.free_above_amount)) return 0;
  if (rate.type === "weight_based") {
    const kg = Number(rate.assumed_kg || 0.5);
    return +(Number(rate.base_rate || 0) + kg * Number(rate.per_kg_rate || 0)).toFixed(2);
  }
  return Number(rate.base_rate ?? listingFallback) || 0;
}

export async function vatRateForCategory(categoryId) {
  try {
    const { rows } = await query(
      `SELECT rate FROM tax_rules
       WHERE is_active = TRUE AND country_code = 'NP'
         AND (category_id = $1 OR category_id IS NULL)
       ORDER BY category_id NULLS LAST LIMIT 1`,
      [categoryId || null],
    );
    if (rows[0]) return Number(rows[0].rate);
  } catch {
    /* table may be empty */
  }
  return 13;
}

export async function shippingRateForSeller(sellerId, sellerSubtotal, listingFallback) {
  try {
    const { rows } = await query(
      `SELECT * FROM shipping_rates
       WHERE is_active = TRUE AND (seller_id = $1 OR seller_id IS NULL)
       ORDER BY seller_id NULLS LAST LIMIT 1`,
      [sellerId],
    );
    if (rows[0]) return shippingFromRate(rows[0], sellerSubtotal, listingFallback);
  } catch {
    /* ignore */
  }
  return Number(listingFallback) || 0;
}

export function expandQueryWithSynonyms(q, synonymRows = []) {
  const tokens = String(q || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const extra = [];
  for (const token of tokens) {
    const row = synonymRows.find((s) => s.term === token);
    if (row?.synonyms) extra.push(...row.synonyms);
  }
  return [...new Set([...tokens, ...extra])].join(" ");
}

export function bestMatchScore({ textRank = 0, sellerScore = 0, soldCount = 0, publishedAt, freeShipping = false }) {
  const freshness = publishedAt && Date.now() - new Date(publishedAt).getTime() < 7 * 86400000 ? 0.3 : 0;
  const velocity = Math.log1p(Number(soldCount) || 0) * 0.15;
  const quality = Math.min(100, Number(sellerScore) || 0) / 200;
  return Number(textRank) * 2 + quality + velocity + freshness + (freeShipping ? 0.15 : 0);
}

export function inQuietHours(spec, now = new Date()) {
  if (!spec || !String(spec).includes("-")) return false;
  const [start, end] = String(spec).split("-").map((s) => s.trim());
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  const from = sh * 60 + (sm || 0);
  const to = eh * 60 + (em || 0);
  if (from === to) return false;
  if (from < to) return mins >= from && mins < to;
  return mins >= from || mins < to;
}

export function ledgerLinesBalance(lines) {
  const debit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const credit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  return { debit, credit, balanced: Math.abs(debit - credit) < 0.009 };
}

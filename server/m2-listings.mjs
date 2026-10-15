import { query } from "./db.mjs";
import { bestMatchScore } from "./commerce-rules.mjs";
import { cdnifyListing } from "./cdn.mjs";

let ready;

export function ensureM2ListingColumns() {
  if (!ready) {
    ready = query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS compare_at NUMERIC(12,2)`)
      .then(() => query(`ALTER TABLE listing_variation_options ADD COLUMN IF NOT EXISTS photo_url TEXT`))
      .catch((err) => {
        ready = null;
        throw err;
      });
  }
  return ready;
}

export function completedRequested(params) {
  const status = String(params.get("status") || "").toLowerCase();
  return params.get("completed") === "1" || status === "sold" || status === "ended" || status === "completed";
}

export function statusClause(completed) {
  return completed
    ? `l.status IN ('sold', 'ended')`
    : `l.status = 'active' AND l.moderation_status = 'approved'`;
}

export function rankListings(rows, sort) {
  if (sort !== "best_match") return rows;
  return [...rows]
    .map((row) => ({
      ...row,
      match_score: bestMatchScore({
        textRank: Number(row.text_rank || 0),
        sellerScore: row.seller_feedback_score,
        soldCount: Number(row.watch_count || 0) + Number(row.view_count || 0) / 8,
        publishedAt: row.published_at,
        freeShipping: row.shipping_free,
      }),
    }))
    .sort((a, b) => b.match_score - a.match_score);
}

export async function listingFacets(whereSql, values) {
  try {
    const { rows } = await query(
      `SELECT pair.key AS name, pair.value AS value, COUNT(*)::int AS count
       FROM listings l
       JOIN categories c ON l.category_id = c.id
       JOIN users u ON l.seller_id = u.id
       LEFT JOIN feedback_scores fs ON fs.user_id = u.id
       CROSS JOIN LATERAL jsonb_each_text(COALESCE(l.specifics, '{}'::jsonb)) AS pair(key, value)
       WHERE ${whereSql}
         AND pair.value IS NOT NULL AND pair.value <> ''
       GROUP BY pair.key, pair.value
       ORDER BY pair.key, count DESC
       LIMIT 80`,
      values,
    );
    const facets = {};
    for (const row of rows) {
      if (!facets[row.name]) facets[row.name] = [];
      facets[row.name].push({ value: row.value, count: row.count });
    }
    return facets;
  } catch {
    return {};
  }
}

export async function getDealListings(limit = 24) {
  await ensureM2ListingColumns();
  const result = await query(
    `SELECT
       l.id, l.title, l.price, l.compare_at, l.format, l.shipping_free,
       l.auction_current_price, l.is_featured, l.is_promoted,
       (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true LIMIT 1) AS primary_photo
     FROM listings l
     WHERE l.status = 'active' AND l.moderation_status = 'approved'
       AND (
         l.is_featured = TRUE OR l.is_promoted = TRUE
         OR (l.compare_at IS NOT NULL AND l.compare_at > COALESCE(l.price, l.auction_current_price, 0))
       )
     ORDER BY l.is_featured DESC, l.published_at DESC
     LIMIT $1`,
    [Math.min(Number(limit) || 24, 48)],
  );
  if (result.rows.length) return { status: 200, body: { listings: result.rows.map(cdnifyListing) } };
  const fallback = await query(
    `SELECT
       l.id, l.title, l.price, l.compare_at, l.format, l.shipping_free,
       l.auction_current_price, l.is_featured, l.is_promoted,
       (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true LIMIT 1) AS primary_photo
     FROM listings l
     WHERE l.status = 'active' AND l.moderation_status = 'approved'
     ORDER BY l.watch_count DESC, l.view_count DESC, l.published_at DESC
     LIMIT $1`,
    [Math.min(Number(limit) || 24, 48)],
  );
  return { status: 200, body: { listings: fallback.rows.map(cdnifyListing) } };
}

export async function getSimilarListings(listingId) {
  const { rows } = await query(
    `SELECT category_id, seller_id FROM listings WHERE id = $1`,
    [listingId],
  );
  if (!rows[0]) return { status: 404, body: { error: "Listing not found" } };
  const result = await query(
    `SELECT
       l.id, l.title, l.price, l.format, l.auction_current_price, l.shipping_free,
       (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true LIMIT 1) AS primary_photo
     FROM listings l
     WHERE l.id <> $1 AND l.category_id = $2 AND l.status = 'active' AND l.moderation_status = 'approved'
     ORDER BY CASE WHEN l.seller_id = $3 THEN 1 ELSE 0 END, l.view_count DESC
     LIMIT 8`,
    [listingId, rows[0].category_id, rows[0].seller_id],
  );
  return { status: 200, body: { listings: result.rows.map(cdnifyListing) } };
}

export async function quoteListingShipping(listingId, destination) {
  const { rows } = await query(
    `SELECT shipping_free, shipping_cost, shipping_international, shipping_international_cost, item_location, shipping_additional
     FROM listings WHERE id = $1`,
    [listingId],
  );
  const listing = rows[0];
  if (!listing) return { status: 404, body: { error: "Listing not found" } };
  const dest = String(destination || "").trim();
  if (listing.shipping_free) {
    return { status: 200, body: { amount: 0, label: "Free shipping", destination: dest || "Nepal" } };
  }
  const origin = String(listing.item_location || "").toLowerCase();
  const city = dest.toLowerCase();
  const originCity = origin.split(",")[0].trim();
  if (city && originCity && (origin.includes(city) || city.includes(originCity))) {
    return {
      status: 200,
      body: { amount: 0, label: "Same city as the seller", destination: dest, combinedAdditional: 0 },
    };
  }
  const international = listing.shipping_international && dest && !/(nepal|kathmandu|pokhara|lalitpur|bhaktapur|biratnagar)/i.test(dest);
  const amount = international
    ? Number(listing.shipping_international_cost || listing.shipping_cost || 0)
    : Number(listing.shipping_cost || 0);
  return {
    status: 200,
    body: {
      amount,
      label: international ? `International to ${dest}` : dest ? `Standard to ${dest}` : "Standard shipping in Nepal",
      destination: dest || "Nepal",
      combinedAdditional: Number(listing.shipping_additional ?? amount * 0.5),
    },
  };
}

export async function saveVariationPhotos(listingId, userId, photos) {
  const owner = await query(`SELECT seller_id FROM listings WHERE id = $1`, [listingId]);
  if (!owner.rows[0] || Number(owner.rows[0].seller_id) !== Number(userId)) {
    return { status: 403, body: { error: "Not authorized" } };
  }
  await ensureM2ListingColumns();
  for (const item of photos || []) {
    const url = String(item.url || "").trim();
    const value = String(item.value || "").trim();
    const name = String(item.name || "Color").trim();
    if (!url || !value) continue;
    await query(
      `UPDATE listing_variation_options o
       SET photo_url = $1
       FROM listing_variations v
       WHERE o.variation_id = v.id AND v.listing_id = $2 AND v.name = $3 AND o.value = $4`,
      [url, listingId, name, value],
    );
  }
  return { status: 200, body: { saved: true } };
}

export function combinedShippingForSeller(items) {
  const billable = items.filter((item) => !item.shipping_free && Number(item.shipping_cost) > 0);
  if (!billable.length) return { shipping_cost: 0, combined: false, note: "Free shipping" };
  const units = billable.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const first = Math.max(...billable.map((item) => Number(item.shipping_cost) || 0));
  const extraEach = Math.max(
    ...billable.map((item) => Number(item.shipping_additional ?? Number(item.shipping_cost) * 0.5)),
  );
  const shipping_cost = first + extraEach * Math.max(0, units - 1);
  return {
    shipping_cost,
    combined: units > 1,
    note: units > 1 ? "Combined shipping: first item at full rate, extra items at the add-on rate" : "Shipping for this seller",
  };
}

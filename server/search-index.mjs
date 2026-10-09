import { query } from "./db.mjs";
import { bestMatchScore, expandQueryWithSynonyms } from "./commerce-rules.mjs";

function osUrl() {
  return process.env.OPENSEARCH_URL || "";
}

async function osFetch(path, init = {}) {
  const base = osUrl();
  if (!base) return null;
  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) {
    console.warn("[search] opensearch", res.status, await res.text().catch(() => ""));
    return null;
  }
  return res.json().catch(() => ({}));
}

export async function indexListing(listingId) {
  const { rows } = await query(
    `SELECT l.id, l.title, l.description, l.format, l.price, l.auction_current_price, l.auction_ends_at,
            l.shipping_free, l.item_location, l.specifics, l.published_at, l.view_count, l.status,
            l.moderation_status, c.name AS category_name, u.username AS seller_username,
            CASE WHEN COALESCE(fs.positive_count,0)+COALESCE(fs.neutral_count,0)+COALESCE(fs.negative_count,0) = 0 THEN 0
                 ELSE 100.0 * COALESCE(fs.positive_count,0) / (COALESCE(fs.positive_count,0)+COALESCE(fs.neutral_count,0)+COALESCE(fs.negative_count,0)) END AS seller_score
     FROM listings l
     JOIN categories c ON c.id = l.category_id
     JOIN users u ON u.id = l.seller_id
     LEFT JOIN feedback_scores fs ON fs.user_id = u.id
     WHERE l.id = $1`,
    [listingId],
  );
  const row = rows[0];
  if (!row || !osUrl()) return false;
  await osFetch(`/listings/_doc/${row.id}`, { method: "PUT", body: JSON.stringify(row) });
  return true;
}

export async function suggestListings(q) {
  const term = String(q || "").trim();
  if (term.length < 2) return [];
  const like = `%${term}%`;
  const cats = await query(
    `SELECT id, name, slug FROM categories
     WHERE is_active = TRUE AND (name ILIKE $1 OR slug ILIKE $1)
     ORDER BY level, name LIMIT 4`,
    [like],
  ).catch(() => ({ rows: [] }));
  let listingRows = [];
  if (osUrl()) {
    const data = await osFetch("/listings/_search", {
      method: "POST",
      body: JSON.stringify({
        size: 8,
        query: { match_phrase_prefix: { title: term } },
        _source: ["title"],
      }),
    });
    if (data?.hits?.hits) {
      listingRows = data.hits.hits.map((h) => ({ id: h._id, title: h._source.title })).filter((r) => r.title);
    }
  }
  if (!listingRows.length) {
    const { rows } = await query(
      `SELECT id, title FROM listings
       WHERE status = 'active' AND moderation_status = 'approved' AND title ILIKE $1
       ORDER BY view_count DESC LIMIT 8`,
      [like],
    );
    listingRows = rows;
  }
  return [
    ...cats.rows.map((c) => ({ type: "category", id: c.id, title: c.name, slug: c.slug })),
    ...listingRows.map((r) => ({ type: "listing", id: Number(r.id), title: r.title })),
  ];
}

function listingSelect() {
  return `
    l.id, l.title, l.subtitle, l.format, l.price, l.quantity,
    l.auction_current_price, l.auction_bid_count, l.auction_ends_at,
    l.shipping_free, l.shipping_cost, l.item_location, l.watch_count, l.published_at, l.specifics,
    c.name as category_name, c.slug as category_slug,
    (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true LIMIT 1) as primary_photo,
    u.username as seller_username,
    CASE WHEN COALESCE(fs.positive_count,0)+COALESCE(fs.neutral_count,0)+COALESCE(fs.negative_count,0) = 0 THEN 0
         ELSE 100.0 * COALESCE(fs.positive_count,0) / NULLIF(COALESCE(fs.positive_count,0)+COALESCE(fs.neutral_count,0)+COALESCE(fs.negative_count,0),0) END as seller_feedback_score
  `;
}

export async function searchListingsAdvanced(params) {
  const q = params.get("q") || "";
  const categoryId = params.get("category_id") || "";
  const categorySlug = params.get("category") || "";
  const exclude = String(params.get("exclude") || "").trim();
  const brandId = params.get("brand_id");
  const format = params.get("format");
  const condition = params.get("condition");
  const minPrice = params.get("min_price");
  const maxPrice = params.get("max_price");
  const location = params.get("location");
  const freeShipping = params.get("free_shipping");
  const minSellerRating = params.get("seller_rating");
  const specifics = params.get("specifics");
  const sort = params.get("sort") || "best_match";
  const limit = Math.min(parseInt(params.get("limit"), 10) || 24, 100);
  const offset = parseInt(params.get("offset"), 10) || 0;

  let synonyms = [];
  try {
    const syn = await query(`SELECT term, synonyms FROM search_synonyms`);
    synonyms = syn.rows;
  } catch {
    synonyms = [];
  }
  const expanded = expandQueryWithSynonyms(q, synonyms);
  const tsQuery = expanded || q;

  const values = [];
  let n = 1;
  let where = `l.status = 'active' AND l.moderation_status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM vacation_mode v
        WHERE v.seller_id = l.seller_id AND v.active = TRUE AND v.hide_listings = TRUE
          AND (v.ends_at IS NULL OR v.ends_at > NOW())
      )`;

  if (tsQuery && tsQuery.length >= 2) {
    where += ` AND (
      to_tsvector('english', l.title || ' ' || COALESCE(l.description,'')) @@ plainto_tsquery('english', $${n})
      OR l.title ILIKE $${n + 1}
    )`;
    values.push(tsQuery, `%${q}%`);
    n += 2;
  }
  if (/^\d+$/.test(categoryId)) {
    where += ` AND l.category_id = $${n++}`;
    values.push(categoryId);
  } else if (categorySlug && categorySlug !== "all" && !/^\d+$/.test(categorySlug)) {
    where += ` AND c.slug = $${n++}`;
    values.push(categorySlug);
  } else if (/^\d+$/.test(categorySlug)) {
    where += ` AND l.category_id = $${n++}`;
    values.push(categorySlug);
  }
  if (exclude.length >= 2) {
    where += ` AND l.title NOT ILIKE $${n++}`;
    values.push(`%${exclude}%`);
  }
  if (brandId) {
    where += ` AND l.brand_id = $${n++}`;
    values.push(brandId);
  }
  if (format) {
    where += ` AND l.format = $${n++}`;
    values.push(format);
  }
  if (condition) {
    where += ` AND l.condition_id = $${n++}`;
    values.push(condition);
  }
  if (minPrice) {
    where += ` AND COALESCE(l.price, l.auction_current_price) >= $${n++}`;
    values.push(minPrice);
  }
  if (maxPrice) {
    where += ` AND COALESCE(l.price, l.auction_current_price) <= $${n++}`;
    values.push(maxPrice);
  }
  if (location) {
    where += ` AND l.item_location ILIKE $${n++}`;
    values.push(`%${location}%`);
  }
  if (freeShipping === "1" || freeShipping === "true") {
    where += ` AND l.shipping_free = TRUE`;
  }
  if (minSellerRating) {
    where += ` AND CASE WHEN COALESCE(fs.positive_count,0)+COALESCE(fs.neutral_count,0)+COALESCE(fs.negative_count,0) = 0 THEN 0 ELSE 100.0 * COALESCE(fs.positive_count,0) / (COALESCE(fs.positive_count,0)+COALESCE(fs.neutral_count,0)+COALESCE(fs.negative_count,0)) END >= $${n++}`;
    values.push(Number(minSellerRating));
  }
  if (specifics) {
    try {
      const spec = JSON.parse(specifics);
      where += ` AND l.specifics @> $${n++}::jsonb`;
      values.push(JSON.stringify(spec));
    } catch {
      /* ignore bad json */
    }
  }

  const rankExpr = tsQuery && tsQuery.length >= 2
    ? `ts_rank(to_tsvector('english', l.title || ' ' || COALESCE(l.description,'')), plainto_tsquery('english', $1))`
    : `0::float`;

  let order = `ORDER BY l.published_at DESC`;
  if (sort === "price_low") order = `ORDER BY COALESCE(l.price, l.auction_current_price) ASC`;
  else if (sort === "price_high") order = `ORDER BY COALESCE(l.price, l.auction_current_price) DESC`;
  else if (sort === "ending_soon") order = `ORDER BY l.auction_ends_at ASC NULLS LAST`;
  else if (sort === "newest") order = `ORDER BY l.published_at DESC`;
  else order = `ORDER BY text_rank DESC, COALESCE(fs.positive_count,0) DESC, l.published_at DESC`;

  const sql = `
    SELECT ${listingSelect()},
           ${rankExpr} AS text_rank
    FROM listings l
    JOIN categories c ON l.category_id = c.id
    JOIN users u ON l.seller_id = u.id
    LEFT JOIN feedback_scores fs ON fs.user_id = u.id
    WHERE ${where}
    ${order}
    LIMIT $${n++} OFFSET $${n++}`;
  values.push(limit, offset);

  const result = await query(sql, values);
  const listings = result.rows.map((row) => ({
    ...row,
    match_score: bestMatchScore({
      textRank: row.text_rank,
      sellerScore: row.seller_feedback_score,
      soldCount: row.watch_count,
      publishedAt: row.published_at,
      freeShipping: row.shipping_free,
    }),
  }));
  if (sort === "best_match") listings.sort((a, b) => b.match_score - a.match_score);

  return {
    status: 200,
    body: {
      listings,
      query: q,
      expanded: expanded !== q ? expanded : undefined,
      engine: osUrl() ? "opensearch+postgres" : "postgres",
      limit,
      offset,
    },
  };
}

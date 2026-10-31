/**
 * Listings API Router
 * Create and manage product listings (fixed price, auctions, variations)
 */

import { query } from './db.mjs';
import { reservationState } from './stock.mjs';
import { uploadPhoto, deletePhoto, setPrimaryPhoto, reorderListingPhotos } from './upload.mjs';
import { enforceVerification, evaluateUser } from './trust.mjs';
import { commerceBlock } from './standing.mjs';
import { validateListingSpecifics } from './catalog.mjs';
import { conditionMatchSql, indexListing, listingSearchVectorSql, searchListingsAdvanced, suggestListings } from './search-index.mjs';
import { notify } from './notify.mjs';
import { sellerDsr } from './m3-commerce.mjs';
import { cdnifyListing } from './cdn.mjs';
import {
  completedRequested,
  ensureM2ListingColumns,
  getDealListings,
  getSimilarListings,
  listingFacets,
  quoteListingShipping,
  rankListings,
  saveVariationPhotos,
  statusClause,
} from './m2-listings.mjs';

/**
 * Main listings router
 */
export async function handleListings(req, method, urlPath, headers, body, ipAddress, userAgent) {
  const url = new URL(`http://localhost${urlPath}`);
  const pathParts = url.pathname.replace('/api/v1/listings', '').split('/').filter(Boolean);

  try {
    await ensureM2ListingColumns();
    // Public endpoints
    if (method === 'GET' && !pathParts[0]) {
      return await getListings(url.searchParams);
    }

    if (method === 'GET' && pathParts[0] === 'deals') {
      return await getDealListings(url.searchParams.get('limit'));
    }

    if (method === 'GET' && pathParts[0] && pathParts[1] === 'similar') {
      return await getSimilarListings(pathParts[0]);
    }

    if (method === 'GET' && pathParts[0] && pathParts[1] === 'shipping') {
      return await quoteListingShipping(pathParts[0], url.searchParams.get('destination') || url.searchParams.get('city'));
    }

    if (method === 'GET' && pathParts[0] && !isNaN(pathParts[0]) && !pathParts[1]) {
      return await getListingById(pathParts[0], headers.authorization);
    }

    if (method === 'GET' && pathParts[0] === 'search') {
      return await searchListingsAdvanced(url.searchParams);
    }

    if (method === 'GET' && pathParts[0] === 'suggest') {
      return { status: 200, body: { suggestions: await suggestListings(url.searchParams.get('q')) } };
    }

    if (method === 'GET' && pathParts[0] === 'featured') {
      return await getFeaturedListings();
    }

    // Auth required endpoints
    const token = headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return { status: 401, body: { error: 'Unauthorized' } };
    }

    const auth = await validateToken(token);
    if (!auth) {
      return { status: 403, body: { error: 'Invalid or expired token' } };
    }

    // Seller listings management
    if (method === 'POST' && !pathParts[0]) {
      return await createListing(body, auth.userId);
    }

    if (method === 'PATCH' && pathParts[0] && !isNaN(pathParts[0])) {
      if (Array.isArray(body?.variation_photos)) {
        const saved = await saveVariationPhotos(pathParts[0], auth.userId, body.variation_photos);
        const extras = Object.keys(body).filter((key) => key !== 'variation_photos');
        if (!extras.length) return saved;
      }
      return await updateListing(pathParts[0], body, auth.userId);
    }

    if (method === 'DELETE' && pathParts[0] && pathParts[1] === 'watch') {
      return await removeFromWatchlist(Number(pathParts[0]), auth.userId);
    }

    if (method === 'DELETE' && pathParts[0] && !isNaN(pathParts[0]) && !pathParts[1]) {
      return await deleteListing(pathParts[0], auth.userId);
    }

    if (method === 'POST' && pathParts[0] && pathParts[1] === 'publish') {
      return await publishListing(pathParts[0], auth.userId);
    }

    if (method === 'POST' && pathParts[0] && pathParts[1] === 'end') {
      return await endListing(pathParts[0], auth.userId);
    }

    if (method === 'POST' && pathParts[0] && pathParts[1] === 'relist') {
      return await relistListing(pathParts[0], auth.userId);
    }

    // Photo management
    if (method === 'POST' && pathParts[0] && pathParts[1] === 'photos' && pathParts[2] === 'upload') {
      // Multipart photo upload
      return await uploadPhoto(req, pathParts[0], auth.userId);
    }

    if (method === 'PATCH' && pathParts[0] && pathParts[1] === 'photos' && pathParts[2] === 'reorder') {
      return await reorderListingPhotos(pathParts[0], body.photo_ids, auth.userId);
    }

    if (method === 'POST' && pathParts[0] && pathParts[1] === 'photos') {
      // Legacy URL-based photo add
      return await addListingPhoto(pathParts[0], body, auth.userId);
    }

    if (method === 'DELETE' && pathParts[0] === 'photos' && pathParts[1]) {
      return await deletePhoto(pathParts[1], auth.userId);
    }

    if (method === 'PATCH' && pathParts[0] === 'photos' && pathParts[1] && pathParts[2] === 'primary') {
      return await setPrimaryPhoto(pathParts[1], auth.userId);
    }

    // Watchlist
    if (method === 'POST' && pathParts[0] && pathParts[1] === 'watch') {
      return await addToWatchlist(Number(pathParts[0]), auth.userId);
    }

    if (method === 'GET' && pathParts[0] === 'watchlist') {
      return await getWatchlist(auth.userId, url.searchParams);
    }

    // Questions
    if (method === 'POST' && pathParts[0] && pathParts[1] === 'question') {
      return await askQuestion(pathParts[0], body, auth.userId);
    }

    if (method === 'PATCH' && pathParts[0] === 'questions' && pathParts[1]) {
      return await answerQuestion(pathParts[1], body, auth.userId);
    }

    // Seller dashboard
    if (method === 'GET' && pathParts[0] === 'seller' && pathParts[1] === 'listings') {
      return await getSellerListings(auth.userId, url.searchParams);
    }

    if (method === 'GET' && pathParts[0] === 'seller' && pathParts[1] === 'analytics') {
      return await getSellerAnalytics(auth.userId);
    }

    if (method === 'GET' && pathParts[0] === 'recent') {
      return await getRecentlyViewed(auth.userId);
    }

    if (method === 'GET' && pathParts[0] === 'saved-searches') {
      return await listSavedSearches(auth.userId);
    }
    if (method === 'POST' && pathParts[0] === 'saved-searches') {
      return await createSavedSearch(auth.userId, body);
    }
    if (method === 'DELETE' && pathParts[0] === 'saved-searches' && pathParts[1]) {
      await query(`DELETE FROM saved_searches WHERE id = $1 AND user_id = $2`, [pathParts[1], auth.userId]);
      return { status: 200, body: { data: { removed: true } } };
    }

    if (method === 'POST' && pathParts[0] === 'bulk') {
      return await bulkImportCsv(auth.userId, body);
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    console.error('Listings API error:', error);
    return { status: 500, body: { error: 'Internal server error', details: error.message } };
  }
}

/**
 * Validate auth token
 */
async function validateToken(token) {
  const crypto = await import('node:crypto');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  
  const result = await query(
    `SELECT u.id as user_id, u.email, u.is_seller, u.status
     FROM auth_sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
    [hash]
  );

  const row = result.rows[0];
  if (!row) return null;
  return { ...row, userId: Number(row.user_id), user_id: Number(row.user_id) };
}

/**
 * Get listings with filters
 */
async function getListings(params) {
  const categoryId = params.get('category_id');
  const brandId = params.get('brand_id');
  const format = params.get('format'); // fixed, auction, both
  const condition = params.get('condition');
  const seller = params.get('seller');
  const minPrice = params.get('min_price');
  const maxPrice = params.get('max_price');
  const sort = params.get('sort') || 'newest'; // newest, price_low, price_high, ending_soon
  const limit = Math.min(parseInt(params.get('limit')) || 24, 100);
  const offset = parseInt(params.get('offset')) || 0;

  let sql = `
    SELECT 
      l.id, l.title, l.subtitle, l.format, l.price, l.quantity,
      l.auction_current_price, l.auction_bid_count, l.auction_ends_at,
      l.shipping_free, l.shipping_cost, l.status, l.view_count, l.watch_count,
      l.created_at, l.published_at, l.compare_at, l.specifics,
      c.name as category_name, c.slug as category_slug,
      b.name as brand_name, b.slug as brand_slug,
      (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true LIMIT 1) as primary_photo,
      u.username as seller_username,
      u.public_id as seller_public_id,
      CASE WHEN COALESCE(fs.positive_count,0)+COALESCE(fs.neutral_count,0)+COALESCE(fs.negative_count,0) = 0 THEN 0
           ELSE 100.0 * COALESCE(fs.positive_count,0) / (COALESCE(fs.positive_count,0)+COALESCE(fs.neutral_count,0)+COALESCE(fs.negative_count,0)) END as seller_feedback_score
    FROM listings l
    JOIN categories c ON l.category_id = c.id
    LEFT JOIN brands b ON l.brand_id = b.id
    JOIN users u ON l.seller_id = u.id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    LEFT JOIN feedback_scores fs ON fs.user_id = u.id
  `;

  const values = [];
  let paramCount = 1;
  const filters = [
    statusClause(completedRequested(params)),
    `NOT EXISTS (
        SELECT 1 FROM vacation_mode v
        WHERE v.seller_id = l.seller_id AND v.active = TRUE AND v.hide_listings = TRUE
          AND (v.ends_at IS NULL OR v.ends_at > NOW())
      )`,
  ];

  if (categoryId) {
    filters.push(`EXISTS (
      SELECT 1 FROM categories sel
      WHERE sel.id = $${paramCount++}
        AND c.lft >= sel.lft AND c.rgt <= sel.rgt
    )`);
    values.push(categoryId);
  }

  if (brandId) {
    filters.push(`l.brand_id = $${paramCount++}`);
    values.push(brandId);
  }

  if (format) {
    filters.push(`l.format = $${paramCount++}`);
    values.push(format);
  }

  if (condition) {
    filters.push(conditionMatchSql("l", `$${paramCount++}`));
    values.push(condition);
  }

  if (seller) {
    filters.push(`(
      u.username ILIKE $${paramCount}
      OR u.public_id::text = $${paramCount}
      OR lower(COALESCE(up.display_name, '')) = lower($${paramCount})
      OR ($${paramCount} ~ '^[0-9]+$' AND u.id = $${paramCount}::bigint)
    )`);
    values.push(seller);
    paramCount += 1;
  }

  if (minPrice) {
    filters.push(`COALESCE(l.price, l.auction_current_price) >= $${paramCount++}`);
    values.push(minPrice);
  }

  if (maxPrice) {
    filters.push(`COALESCE(l.price, l.auction_current_price) <= $${paramCount++}`);
    values.push(maxPrice);
  }

  const location = params.get('location');
  const freeShipping = params.get('free_shipping');
  const minSellerRating = params.get('seller_rating');
  if (location) {
    filters.push(`l.item_location ILIKE $${paramCount++}`);
    values.push(`%${location}%`);
  }
  if (freeShipping === '1' || freeShipping === 'true') {
    filters.push(`l.shipping_free = TRUE`);
  }
  if (minSellerRating) {
    filters.push(`CASE WHEN COALESCE(fs.positive_count,0)+COALESCE(fs.neutral_count,0)+COALESCE(fs.negative_count,0) = 0 THEN 0 ELSE 100.0 * COALESCE(fs.positive_count,0) / (COALESCE(fs.positive_count,0)+COALESCE(fs.neutral_count,0)+COALESCE(fs.negative_count,0)) END >= $${paramCount++}`);
    values.push(Number(minSellerRating));
  }
  const specifics = params.get('specifics');
  if (specifics) {
    try {
      filters.push(`l.specifics @> $${paramCount++}::jsonb`);
      values.push(JSON.stringify(JSON.parse(specifics)));
    } catch {
      /* ignore */
    }
  }

  const whereSql = filters.join(' AND ');
  const whereValues = [...values];
  sql += ` WHERE ${whereSql}`;

  // Sorting
  switch (sort) {
    case 'price_low':
      sql += ` ORDER BY COALESCE(l.price, l.auction_current_price) ASC`;
      break;
    case 'price_high':
      sql += ` ORDER BY COALESCE(l.price, l.auction_current_price) DESC`;
      break;
    case 'ending_soon':
      sql += ` ORDER BY l.auction_ends_at ASC NULLS LAST`;
      break;
    case 'popular':
      sql += ` ORDER BY l.view_count DESC, l.watch_count DESC`;
      break;
    case 'best_match':
      sql += ` ORDER BY COALESCE(fs.positive_count,0) DESC, l.published_at DESC`;
      break;
    default:
      sql += ` ORDER BY l.published_at DESC`;
  }

  sql += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
  values.push(limit, offset);

  const result = await query(sql, values);
  const listings = rankListings(result.rows, sort).map(cdnifyListing);
  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM listings l
     JOIN categories c ON l.category_id = c.id
     LEFT JOIN brands b ON l.brand_id = b.id
     JOIN users u ON l.seller_id = u.id
     LEFT JOIN user_profiles up ON up.user_id = u.id
     LEFT JOIN feedback_scores fs ON fs.user_id = u.id
     WHERE ${whereSql}`,
    whereValues,
  );
  const facets = await listingFacets(whereSql, whereValues);
  const total = Number(countResult.rows[0]?.total || listings.length);

  return {
    status: 200,
    body: {
      listings,
      total,
      facets,
      limit,
      offset,
      hasMore: offset + listings.length < total,
    }
  };
}

/**
 * Get listing by ID
 */
async function getListingById(listingId, authHeader) {
  let viewerId = null;
  const token = authHeader?.replace('Bearer ', '');
  if (token) {
    const auth = await validateToken(token);
    viewerId = auth?.userId ?? null;
  }

  const result = await query(
    `SELECT 
      l.*,
      c.name as category_name, c.slug as category_slug,
      b.name as brand_name, b.slug as brand_slug, b.is_verified as brand_is_verified,
      cond.name as condition_name, cond.slug as condition_slug, cond.description as condition_guide,
      u.id as seller_id, u.public_id as seller_public_id, u.username as seller_username, u.email as seller_email,
      u.created_at as seller_created_at, u.account_type as seller_account_type,
      up.display_name as seller_full_name, up.avatar_url as seller_avatar, up.country as seller_country,
      CASE WHEN COALESCE(fs.positive_count,0)+COALESCE(fs.neutral_count,0)+COALESCE(fs.negative_count,0) = 0 THEN 0
           ELSE 100.0 * COALESCE(fs.positive_count,0) / (COALESCE(fs.positive_count,0)+COALESCE(fs.neutral_count,0)+COALESCE(fs.negative_count,0)) END as seller_feedback_score, fs.positive_count, fs.neutral_count, fs.negative_count,
      (SELECT json_agg(json_build_object(
        'id', p.id, 'url', p.url, 'thumbnail_url', p.thumbnail_url, 
        'position', p.position, 'is_primary', p.is_primary
      ) ORDER BY p.position)
       FROM listing_photos p WHERE p.listing_id = l.id) as photos,
      (SELECT json_agg(json_build_object(
        'id', q.id, 'question', q.question, 'answer', q.answer, 'created_at', q.created_at,
        'answered_at', q.answered_at,
        'asker', COALESCE(ap.display_name, au.username, 'Member')
      ) ORDER BY q.created_at DESC)
       FROM listing_questions q
       JOIN users au ON au.id = q.asker_id
       LEFT JOIN user_profiles ap ON ap.user_id = au.id
       WHERE q.listing_id = l.id AND (
         q.is_public = true
         OR ($2::int IS NOT NULL AND (l.seller_id = $2 OR q.asker_id = $2))
       )) as questions
    FROM listings l
    JOIN categories c ON l.category_id = c.id
    LEFT JOIN brands b ON l.brand_id = b.id
    LEFT JOIN conditions cond ON l.condition_id = cond.id
    JOIN users u ON l.seller_id = u.id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    LEFT JOIN feedback_scores fs ON fs.user_id = u.id
    WHERE l.id = $1 AND (
      l.status IN ('active', 'sold', 'ended')
      OR ($2::int IS NOT NULL AND l.seller_id = $2)
    )`,
    [listingId, viewerId]
  );

  if (!result.rows[0]) {
    return { status: 404, body: { error: 'Listing not found' } };
  }

  const listing = result.rows[0];
  const [variationRows, skuRows] = await Promise.all([
    query(
      `SELECT v.id, v.name, v.position,
              COALESCE((
                SELECT json_agg(json_build_object('id', o.id, 'value', o.value, 'photo_url', o.photo_url) ORDER BY o.position)
                FROM listing_variation_options o WHERE o.variation_id = v.id
              ), '[]'::json) AS options
       FROM listing_variations v
       WHERE v.listing_id = $1
       ORDER BY v.position`,
      [listingId],
    ),
    query(
      `SELECT id, sku, combination, price, quantity
       FROM listing_variation_skus
       WHERE listing_id = $1 AND is_active = TRUE
       ORDER BY id`,
      [listingId],
    ),
  ]);
  listing.variations = variationRows.rows;
  listing.skus = skuRows.rows;
  listing.dsr = await sellerDsr(listing.seller_id);
  const reserveAmount = Number(listing.auction_reserve_price || 0);
  listing.has_reserve = reserveAmount > 0;
  try {
    const state = await query(`SELECT reserve_met FROM auction_states WHERE listing_id = $1`, [listingId]);
    listing.reserve_met = Boolean(state.rows[0]?.reserve_met);
  } catch {
    listing.reserve_met = false;
  }
  const isOwner = viewerId != null && Number(listing.seller_id) === Number(viewerId);
  if (!isOwner) delete listing.auction_reserve_price;
  const hold = await reservationState(listing.id, null, viewerId);
  listing.available = hold.available;
  listing.reserved = hold.reserved;
  listing.temporarily_unavailable = hold.temporarily_unavailable;
  listing.reserved_until = hold.reserved_until;
  Object.assign(listing, cdnifyListing(listing));

  void (async () => {
    if (viewerId && Number(listing.seller_id) === Number(viewerId) && listing.status !== 'active') return;
    await query(
      `INSERT INTO listing_views (listing_id, user_id, ip_address, user_agent, viewed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [listingId, viewerId, null, null],
    );
    await query(`UPDATE listings SET view_count = view_count + 1 WHERE id = $1`, [listingId]);
    if (viewerId) {
      await query(
        `INSERT INTO recently_viewed (user_id, listing_id, viewed_at) VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, listing_id) DO UPDATE SET viewed_at = NOW()`,
        [viewerId, listingId],
      );
    }
  })().catch(() => {});

  return { status: 200, body: { listing } };
}

/**
 * Search listings
 */
async function searchListings(params) {
  const q = params.get('q');
  const categoryId = params.get('category_id');
  const limit = Math.min(parseInt(params.get('limit')) || 24, 100);
  const offset = parseInt(params.get('offset')) || 0;

  if (!q || q.length < 2) {
    return { status: 400, body: { error: 'Search query must be at least 2 characters' } };
  }

  let sql = `
    SELECT 
      l.id, l.title, l.subtitle, l.format, l.price, l.quantity,
      l.auction_current_price, l.auction_bid_count, l.auction_ends_at,
      l.shipping_free, l.shipping_cost, l.watch_count,
      c.name as category_name, c.slug as category_slug,
      (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true LIMIT 1) as primary_photo,
      u.username as seller_username,
      u.public_id as seller_public_id,
      ts_rank(${listingSearchVectorSql("l")}, plainto_tsquery('english', $1)) as rank
    FROM listings l
    JOIN categories c ON l.category_id = c.id
    JOIN users u ON l.seller_id = u.id
    WHERE l.status = 'active' AND l.moderation_status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM vacation_mode v
        WHERE v.seller_id = l.seller_id AND v.active = TRUE AND v.hide_listings = TRUE
          AND (v.ends_at IS NULL OR v.ends_at > NOW())
      )
      AND ${listingSearchVectorSql("l")} @@ plainto_tsquery('english', $1)
  `;

  const values = [q];
  let paramCount = 2;

  if (categoryId) {
    sql += ` AND EXISTS (
      SELECT 1 FROM categories sel
      WHERE sel.id = $${paramCount++}
        AND c.lft >= sel.lft AND c.rgt <= sel.rgt
    )`;
    values.push(categoryId);
  }

  sql += ` ORDER BY rank DESC, l.published_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
  values.push(limit, offset);

  const result = await query(sql, values);

  return {
    status: 200,
    body: {
      listings: result.rows.map(cdnifyListing),
      query: q,
      limit,
      offset
    }
  };
}

/**
 * Get featured listings
 */
async function getFeaturedListings() {
  const result = await query(
    `SELECT 
      l.id, l.title, l.subtitle, l.format, l.price, l.quantity,
      l.auction_current_price, l.auction_ends_at,
      (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true LIMIT 1) as primary_photo,
      c.name as category_name, u.username as seller_username
    FROM listings l
    JOIN categories c ON l.category_id = c.id
    JOIN users u ON l.seller_id = u.id
    WHERE l.status = 'active' AND l.is_featured = true AND l.moderation_status = 'approved'
    ORDER BY l.published_at DESC
    LIMIT 12`
  );

  return { status: 200, body: { listings: result.rows.map(cdnifyListing) } };
}

async function ensureSeller(userId) {
  const userCheck = await query(
    'SELECT is_seller, account_type FROM users WHERE id = $1',
    [userId],
  );
  const row = userCheck.rows[0];
  if (!row) return { status: 401, body: { error: 'Sign in required' } };
  if (row.is_seller) return null;
  if (row.account_type !== 'business') {
    return { status: 403, body: { error: 'Seller account required' } };
  }
  await query('UPDATE users SET is_seller = TRUE, updated_at = NOW() WHERE id = $1', [userId]);
  await query('UPDATE user_profiles SET buyer_only = FALSE WHERE user_id = $1', [userId]).catch(() => {});
  return null;
}

/**
 * Create listing (seller)
 */
async function createListing(data, userId) {
  const blocked = await commerceBlock(userId);
  if (blocked) return blocked;
  const verified = await enforceVerification(userId);
  if (verified) return verified;
  const sellerGate = await ensureSeller(userId);
  if (sellerGate) return sellerGate;

  const {
    category_id, brand_id, title, subtitle, description, condition_id, condition_description,
    format, price, quantity, auction_start_price, auction_reserve_price, auction_duration,
    allow_best_offer, auto_accept_price, auto_decline_price,
    shipping_free, shipping_cost, shipping_international, shipping_international_cost,
    item_location, sku, upc, specifics, publish_immediately, compare_at, shipping_additional
  } = data;
  const saveAsDraft = data.save_as_draft === true || publish_immediately === false;

  if (saveAsDraft) {
    if (!category_id || !String(title || "").trim()) {
      return { status: 400, body: { error: 'Enter a title and category to save this draft' } };
    }
  } else if (!category_id || !title || !description || !format) {
    return { status: 400, body: { error: 'Missing required fields: category_id, title, description, format' } };
  }

  if (!saveAsDraft) {
    const specError = await validateListingSpecifics(category_id, specifics);
    if (specError) return specError;
  }

  const listingFormat = format || 'fixed';
  const listingDescription = description == null ? '' : String(description);
  const isAuction = listingFormat === 'auction' || listingFormat === 'both';
  const allowedDurations = new Set([72, 120, 168, 240]);
  const durationHours = allowedDurations.has(Number(auction_duration))
    ? Number(auction_duration)
    : 168;
  const startPrice = Number(auction_start_price || (isAuction ? 0 : price) || 0);
  const reservePrice = auction_reserve_price == null || auction_reserve_price === ''
    ? null
    : Number(auction_reserve_price);
  if (isAuction && !saveAsDraft) {
    if (!(startPrice > 0)) {
      return { status: 400, body: { error: 'Enter a starting price for this auction' } };
    }
    if (reservePrice != null && Number.isFinite(reservePrice) && reservePrice > 0 && reservePrice < startPrice) {
      return { status: 400, body: { error: 'Reserve price must be at least the starting price' } };
    }
    if (listingFormat === 'both' && !(Number(price) > 0)) {
      return { status: 400, body: { error: 'Enter a Buy It Now price' } };
    }
    if (listingFormat === 'both' && Number(price) <= startPrice) {
      return { status: 400, body: { error: 'Buy It Now price must be higher than the starting bid' } };
    }
  }

  if (allow_best_offer && !saveAsDraft && (listingFormat === 'fixed' || listingFormat === 'both')) {
    const listedPrice = skuPrice(price);
    const acceptAt = skuPrice(auto_accept_price);
    const declineAt = skuPrice(auto_decline_price);
    if (acceptAt != null && listedPrice != null && acceptAt > listedPrice) {
      return { status: 400, body: { error: 'Auto-accept must be at or below the listed price' } };
    }
    if (declineAt != null && acceptAt != null && declineAt >= acceptAt) {
      return { status: 400, body: { error: 'Auto-decline must be lower than auto-accept' } };
    }
  }

  const status = publish_immediately && !saveAsDraft ? 'active' : 'draft';
  const publishedAt = status === 'active' ? 'NOW()' : 'NULL';
  const risk = await evaluateUser(userId, { kind: 'listing', title, description: listingDescription });
  if (risk.blocked) return { status: 403, body: { error: 'This listing was blocked by trust and safety rules' } };
  const moderation = risk.flagged ? 'flagged' : 'approved';
  if (risk.flagged) {
    await query(
      `INSERT INTO moderation_queue (item_type, item_id, reason, score) VALUES ('listing','pending', $1, $2)`,
      [risk.hits.map((h) => h.name).join(','), risk.score],
    ).catch(() => {});
  }

  const result = await query(
    `INSERT INTO listings (
      seller_id, category_id, brand_id, title, subtitle, description, 
      condition_id, condition_description, format, price, quantity,
      auction_start_price, auction_reserve_price, auction_duration,
      allow_best_offer, auto_accept_price, auto_decline_price,
      shipping_free, shipping_cost, shipping_international, shipping_international_cost,
      item_location, sku, upc, specifics, status, published_at,
      auction_starts_at, auction_ends_at, auction_current_price, moderation_status, compare_at, shipping_additional
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, ${publishedAt},
      ${status === 'active' && isAuction ? 'NOW()' : 'NULL'},
      ${status === 'active' && isAuction ? `NOW() + INTERVAL '${durationHours} hours'` : 'NULL'},
      $27, $28, $29, $30)
    RETURNING *`,
    [
      userId, category_id || null, brand_id || null, title, subtitle || "", listingDescription,
      condition_id || null, condition_description || "", listingFormat, skuPrice(price) ?? (isAuction ? startPrice || null : null), quantity || 1,
      startPrice || null, reservePrice, durationHours,
      Boolean(allow_best_offer), skuPrice(auto_accept_price), skuPrice(auto_decline_price),
      Boolean(shipping_free), skuPrice(shipping_cost), Boolean(shipping_international), skuPrice(shipping_international_cost),
      item_location || "", sku || "", upc || "", JSON.stringify(specifics || {}), status, startPrice || null, moderation,
      skuPrice(compare_at), skuPrice(shipping_additional)
    ]
  );
  if (risk.flagged && result.rows[0]) {
    await query(
      `INSERT INTO moderation_queue (item_type, item_id, reason, score) VALUES ('listing', $1, $2, $3)`,
      [String(result.rows[0].id), 'prohibited or velocity', risk.score],
    ).catch(() => {});
  }

  const listing = result.rows[0];
  const variationAxes = Array.isArray(data.variations)
    ? data.variations.filter((item) => item?.name && Array.isArray(item.options) && item.options.length)
    : [];
  if (variationAxes.length && listing) {
    await saveVariations(listing.id, variationAxes, data.skus, { price: data.price, quantity: data.quantity });
    await syncListingStockFromSkus(listing.id);
  }
  if (listing?.status === 'active') await indexListing(listing.id).catch(() => {});
  if (listing) await snapshotListingDraft(listing.id, userId, data);

  return { status: 201, body: { listing } };
}

/**
 * Update listing (seller)
 */
async function updateListing(listingId, data, userId) {
  // Verify ownership
  const ownerCheck = await query('SELECT seller_id FROM listings WHERE id = $1', [listingId]);
  if (!ownerCheck.rows[0] || ownerCheck.rows[0].seller_id !== userId) {
    return { status: 403, body: { error: 'Not authorized' } };
  }

  const fields = [];
  const values = [];
  let paramCount = 1;

  const allowed = [
    'title', 'subtitle', 'description', 'condition_id', 'condition_description',
    'price', 'quantity', 'brand_id', 'shipping_free', 'shipping_cost',
    'shipping_international', 'shipping_international_cost', 'item_location',
    'sku', 'upc', 'allow_best_offer', 'auto_accept_price', 'auto_decline_price',
    'compare_at', 'shipping_additional', 'is_featured'
  ];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${paramCount++}`);
      values.push(data[key]);
    }
  }

  if (data.specifics) {
    const categoryRow = await query("SELECT category_id FROM listings WHERE id = $1", [listingId]);
    const specError = await validateListingSpecifics(data.category_id || categoryRow.rows[0]?.category_id, data.specifics);
    if (specError) return specError;
    fields.push(`specifics = $${paramCount++}`);
    values.push(JSON.stringify(data.specifics));
  }

  if (Array.isArray(data.variations) && data.variations.length) {
    const existing = await query(`SELECT 1 FROM listing_variations WHERE listing_id = $1 LIMIT 1`, [listingId]);
    if (!existing.rows[0]) {
      await saveVariations(listingId, data.variations, data.skus, { price: data.price, quantity: data.quantity });
    } else if (Array.isArray(data.skus)) {
      await replaceListingSkus(listingId, data.skus);
    }
  } else if (Array.isArray(data.skus)) {
    await replaceListingSkus(listingId, data.skus);
  }

  if (Array.isArray(data.skus) || Array.isArray(data.variations)) {
    await syncListingStockFromSkus(listingId);
  }

  if (fields.length === 0) {
    const listing = await query('SELECT * FROM listings WHERE id = $1', [listingId]);
    if (!listing.rows[0]) return { status: 404, body: { error: 'Listing not found' } };
    return { status: 200, body: { listing: listing.rows[0] } };
  }

  fields.push(`updated_at = NOW()`);
  values.push(listingId);

  const result = await query(
    `UPDATE listings SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (Array.isArray(data.skus) || Array.isArray(data.variations)) {
    const fresh = await query('SELECT * FROM listings WHERE id = $1', [listingId]);
    const listing = fresh.rows[0] || result.rows[0];
    if (listing) await snapshotListingDraft(listingId, userId, data);
    return { status: 200, body: { listing } };
  }

  if (result.rows[0]) await snapshotListingDraft(listingId, userId, data);
  return { status: 200, body: { listing: result.rows[0] } };
}

/**
 * Delete listing (seller)
 */
async function deleteListing(listingId, userId) {
  const ownerCheck = await query('SELECT seller_id, status FROM listings WHERE id = $1', [listingId]);
  if (!ownerCheck.rows[0] || ownerCheck.rows[0].seller_id !== userId) {
    return { status: 403, body: { error: 'Not authorized' } };
  }

  if (ownerCheck.rows[0].status === 'active' && ownerCheck.rows[0].auction_bid_count > 0) {
    return { status: 400, body: { error: 'Cannot delete active listing with bids' } };
  }

  await query('UPDATE listings SET status = $1, ended_at = NOW() WHERE id = $2', ['removed', listingId]);
  return { status: 200, body: { success: true } };
}

/**
 * Publish listing
 */
async function publishListing(listingId, userId) {
  const verified = await enforceVerification(userId);
  if (verified) return verified;
  const ownerCheck = await query('SELECT seller_id, status FROM listings WHERE id = $1', [listingId]);
  if (!ownerCheck.rows[0] || ownerCheck.rows[0].seller_id !== userId) {
    return { status: 403, body: { error: 'Not authorized' } };
  }

  if (ownerCheck.rows[0].status !== 'draft') {
    return { status: 400, body: { error: 'Only draft listings can be published' } };
  }

  const ready = await query(
    `SELECT title, description, format, price, auction_start_price FROM listings WHERE id = $1`,
    [listingId],
  );
  const row = ready.rows[0] || {};
  if (!String(row.description || "").trim()) {
    return { status: 400, body: { error: 'Add a description before publishing' } };
  }
  const isAuction = row.format === 'auction' || row.format === 'both';
  const isFixed = row.format === 'fixed' || row.format === 'both';
  if (isFixed && !(Number(row.price) > 0)) {
    return { status: 400, body: { error: 'Add a Buy It Now price before publishing' } };
  }
  if (isAuction && !(Number(row.auction_start_price || row.price) > 0)) {
    return { status: 400, body: { error: 'Add a starting bid before publishing' } };
  }

  await query(
    `UPDATE listings SET
       status = 'active',
       published_at = NOW(),
       moderation_status = CASE WHEN moderation_status = 'rejected' THEN moderation_status ELSE 'approved' END,
       auction_starts_at = CASE WHEN format IN ('auction','both') THEN COALESCE(auction_starts_at, NOW()) ELSE auction_starts_at END,
       auction_ends_at = CASE WHEN format IN ('auction','both') THEN COALESCE(auction_ends_at, NOW() + (COALESCE(auction_duration, 168) || ' hours')::interval) ELSE auction_ends_at END,
       auction_current_price = CASE WHEN format IN ('auction','both') THEN COALESCE(auction_current_price, auction_start_price, price) ELSE auction_current_price END
     WHERE id = $1`,
    [listingId]
  );
  await snapshotListingDraft(listingId, userId, { published: true, from: 'draft' });
  await indexListing(listingId).catch(() => {});

  return { status: 200, body: { success: true, status: 'active' } };
}

/**
 * End listing
 */
async function endListing(listingId, userId) {
  const ownerCheck = await query('SELECT seller_id, status FROM listings WHERE id = $1', [listingId]);
  if (!ownerCheck.rows[0] || Number(ownerCheck.rows[0].seller_id) !== Number(userId)) {
    return { status: 403, body: { error: 'Not authorized' } };
  }
  if (ownerCheck.rows[0].status !== 'active') {
    return { status: 400, body: { error: 'Only active listings can be ended' } };
  }

  await query(
    `UPDATE listings SET status = 'ended', ended_at = NOW() WHERE id = $1`,
    [listingId]
  );
  await indexListing(listingId).catch(() => {});

  return { status: 200, body: { success: true, status: 'ended' } };
}

/**
 * Relist an ended or sold listing as a new active copy.
 */
async function relistListing(listingId, userId) {
  const ownerCheck = await query('SELECT * FROM listings WHERE id = $1', [listingId]);
  const source = ownerCheck.rows[0];
  if (!source || Number(source.seller_id) !== Number(userId)) {
    return { status: 403, body: { error: 'Not authorized' } };
  }

  if (!['ended', 'sold'].includes(source.status)) {
    return { status: 400, body: { error: 'Only ended or sold listings can be relisted' } };
  }

  const isAuction = source.format === 'auction' || source.format === 'both';
  const durationHours = [72, 120, 168, 240].includes(Number(source.auction_duration))
    ? Number(source.auction_duration)
    : 168;
  const copiedQty = Math.max(Number(source.quantity) || 0, 1);

  const created = await query(
    `INSERT INTO listings (
      seller_id, category_id, brand_id, title, subtitle, description,
      condition_id, condition_description, format, price, quantity,
      auction_start_price, auction_reserve_price, auction_buy_now_price, auction_duration,
      allow_best_offer, auto_accept_price, auto_decline_price,
      shipping_free, shipping_cost, shipping_additional, shipping_international, shipping_international_cost,
      handling_time_days, item_location, sku, upc, specifics, compare_at,
      status, published_at, ended_at, moderation_status, relisted_from_id,
      auction_starts_at, auction_ends_at, auction_current_price, auction_bid_count, auction_winner_id
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,
      'active', NOW(), NULL, 'approved', $30,
      ${isAuction ? 'NOW()' : 'NULL'},
      ${isAuction ? `NOW() + INTERVAL '${durationHours} hours'` : 'NULL'},
      $31, 0, NULL
    ) RETURNING id, status, title, price, quantity`,
    [
      source.seller_id, source.category_id, source.brand_id, source.title, source.subtitle, source.description,
      source.condition_id, source.condition_description, source.format, source.price, copiedQty,
      source.auction_start_price, source.auction_reserve_price, source.auction_buy_now_price, source.auction_duration,
      source.allow_best_offer, source.auto_accept_price, source.auto_decline_price,
      source.shipping_free, source.shipping_cost, source.shipping_additional, source.shipping_international, source.shipping_international_cost,
      source.handling_time_days, source.item_location, source.sku, source.upc, source.specifics, source.compare_at,
      source.id,
      isAuction ? (source.auction_start_price || source.price) : source.auction_current_price,
    ],
  );
  const copy = created.rows[0];

  await query(
    `INSERT INTO listing_photos (listing_id, url, thumbnail_url, position, width, height, size_bytes, is_primary)
     SELECT $1, url, thumbnail_url, position, width, height, size_bytes, is_primary
     FROM listing_photos WHERE listing_id = $2`,
    [copy.id, source.id],
  ).catch(() => {});

  const variations = await query(
    `SELECT id, name, position FROM listing_variations WHERE listing_id = $1 ORDER BY position, id`,
    [source.id],
  ).catch(() => ({ rows: [] }));
  for (const variation of variations.rows) {
    const inserted = await query(
      `INSERT INTO listing_variations (listing_id, name, position) VALUES ($1,$2,$3) RETURNING id`,
      [copy.id, variation.name, variation.position],
    );
    await query(
      `INSERT INTO listing_variation_options (variation_id, value, position, photo_url)
       SELECT $1, value, position, photo_url FROM listing_variation_options WHERE variation_id = $2`,
      [inserted.rows[0].id, variation.id],
    ).catch(() => {});
  }
  await query(
    `INSERT INTO listing_variation_skus (listing_id, sku, combination, price, quantity, is_active)
     SELECT $1, sku, combination, price, GREATEST(quantity, 0), COALESCE(is_active, TRUE)
     FROM listing_variation_skus WHERE listing_id = $2`,
    [copy.id, source.id],
  ).catch(() => {});

  await indexListing(copy.id).catch(() => {});
  return { status: 201, body: { success: true, data: copy, relisted_from_id: source.id } };
}

/**
 * Add photo to listing
 */
async function addListingPhoto(listingId, data, userId) {
  const ownerCheck = await query('SELECT seller_id FROM listings WHERE id = $1', [listingId]);
  if (!ownerCheck.rows[0] || ownerCheck.rows[0].seller_id !== userId) {
    return { status: 403, body: { error: 'Not authorized' } };
  }

  const { url, thumbnail_url, width, height, size_bytes, is_primary } = data;

  if (!url) {
    return { status: 400, body: { error: 'URL is required' } };
  }

  // Get next position
  const posResult = await query(
    'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM listing_photos WHERE listing_id = $1',
    [listingId]
  );
  const position = posResult.rows[0].next_pos;

  // If this is marked as primary, unset others
  if (is_primary) {
    await query('UPDATE listing_photos SET is_primary = false WHERE listing_id = $1', [listingId]);
  }

  const result = await query(
    `INSERT INTO listing_photos (listing_id, url, thumbnail_url, position, width, height, size_bytes, is_primary)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [listingId, url, thumbnail_url, position, width, height, size_bytes, is_primary || false]
  );

  return { status: 201, body: { photo: result.rows[0] } };
}

/**
 * Delete photo from listing
 */
async function deleteListingPhoto(photoId, userId) {
  const ownerCheck = await query(
    `SELECT l.seller_id 
     FROM listing_photos p
     JOIN listings l ON p.listing_id = l.id
     WHERE p.id = $1`,
    [photoId]
  );

  if (!ownerCheck.rows[0] || ownerCheck.rows[0].seller_id !== userId) {
    return { status: 403, body: { error: 'Not authorized' } };
  }

  await query('DELETE FROM listing_photos WHERE id = $1', [photoId]);
  return { status: 200, body: { success: true } };
}

/**
 * Add to watchlist
 */
async function addToWatchlist(listingId, userId) {
  const inserted = await query(
    `INSERT INTO watchlist (user_id, listing_id) VALUES ($1, $2)
     ON CONFLICT (user_id, listing_id) DO NOTHING
     RETURNING listing_id`,
    [Number(userId), Number(listingId)],
  );

  if (inserted.rowCount > 0) {
    await query('UPDATE listings SET watch_count = watch_count + 1 WHERE id = $1', [Number(listingId)]);
  }

  return { status: 200, body: { success: true } };
}

/**
 * Remove from watchlist
 */
async function removeFromWatchlist(listingId, userId) {
  const result = await query(
    'DELETE FROM watchlist WHERE user_id = $1 AND listing_id = $2 RETURNING *',
    [Number(userId), Number(listingId)]
  );

  if (result.rowCount > 0) {
    await query('UPDATE listings SET watch_count = GREATEST(watch_count - 1, 0) WHERE id = $1', [Number(listingId)]);
  }

  return { status: 200, body: { success: true } };
}

/**
 * Get watchlist
 */
async function getWatchlist(userId, params) {
  const limit = Math.min(parseInt(params.get('limit')) || 50, 200);
  const offset = parseInt(params.get('offset')) || 0;

  const result = await query(
    `SELECT 
      l.id, l.title, l.format, l.price, l.quantity, l.status,
      l.auction_current_price, l.auction_ends_at,
      w.added_at,
      (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true LIMIT 1) as primary_photo
    FROM watchlist w
    JOIN listings l ON w.listing_id = l.id
    WHERE w.user_id = $1
    ORDER BY w.added_at DESC
    LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return { status: 200, body: { listings: result.rows.map(cdnifyListing), limit, offset } };
}

/**
 * Ask question on listing
 */
async function askQuestion(listingId, data, userId) {
  const { question } = data;

  if (!question || question.length < 10) {
    return { status: 400, body: { error: 'Question must be at least 10 characters' } };
  }

  const owner = await query(`SELECT seller_id, title FROM listings WHERE id = $1`, [listingId]);
  if (!owner.rows[0]) return { status: 404, body: { error: 'Listing not found' } };
  if (Number(owner.rows[0].seller_id) === Number(userId)) {
    return { status: 400, body: { error: 'Sellers cannot ask a question on their own listing' } };
  }

  const result = await query(
    `INSERT INTO listing_questions (listing_id, asker_id, question)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [listingId, userId, question]
  );

  await query('UPDATE listings SET question_count = question_count + 1 WHERE id = $1', [listingId]);
  await notify(
    owner.rows[0].seller_id,
    "question",
    "New question on your listing",
    question.slice(0, 140),
    `/listing/${listingId}`,
  );

  return { status: 201, body: { question: result.rows[0] } };
}

/**
 * Answer question (seller)
 */
async function answerQuestion(questionId, data, userId) {
  const { answer } = data;
  const isPublic = data.public !== false && data.is_public !== false;

  if (!answer) {
    return { status: 400, body: { error: 'Answer is required' } };
  }

  // Verify seller ownership
  const checkResult = await query(
    `SELECT l.seller_id
     FROM listing_questions q
     JOIN listings l ON q.listing_id = l.id
     WHERE q.id = $1`,
    [questionId]
  );

  if (!checkResult.rows[0] || Number(checkResult.rows[0].seller_id) !== Number(userId)) {
    return { status: 403, body: { error: 'Not authorized' } };
  }

  const result = await query(
    `UPDATE listing_questions 
     SET answer = $1, answered_by = $2, answered_at = NOW(), is_public = $4
     WHERE id = $3
     RETURNING *`,
    [answer, userId, questionId, isPublic]
  );
  if (result.rows[0]) {
    await notify(
      result.rows[0].asker_id,
      "question",
      "Your question was answered",
      answer.slice(0, 140),
      `/listing/${result.rows[0].listing_id}`,
    );
  }

  return { status: 200, body: { question: result.rows[0] } };
}

/**
 * Get seller listings
 */
async function getSellerListings(userId, params) {
  const status = params.get('status') || 'all';
  const limit = Math.min(parseInt(params.get('limit')) || 50, 200);
  const offset = parseInt(params.get('offset')) || 0;
  userId = Number(userId);

  let sql = `
    SELECT 
      l.id, l.title, l.format, l.price, l.quantity, l.status,
      l.auction_current_price, l.auction_bid_count, l.view_count, l.watch_count,
      l.created_at, l.published_at,
      c.name as category_name,
      (SELECT url FROM listing_photos WHERE listing_id = l.id ORDER BY is_primary DESC, position LIMIT 1) as primary_photo
    FROM listings l
    JOIN categories c ON l.category_id = c.id
    WHERE l.seller_id = $1
  `;

  const values = [userId];
  let paramCount = 2;

  if (status !== 'all') {
    sql += ` AND l.status = $${paramCount++}`;
    values.push(status);
  }

  sql += ` ORDER BY l.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
  values.push(limit, offset);

  const result = await query(sql, values);

  return { status: 200, body: { listings: result.rows.map(cdnifyListing), limit, offset } };
}

/**
 * Get seller analytics
 */
async function getSellerAnalytics(userId) {
  userId = Number(userId);
  const statsResult = await query(
    `SELECT 
       COUNT(*) FILTER (WHERE status = 'active') as active_count,
       COUNT(*) FILTER (WHERE status = 'sold') as sold_count,
       COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
       SUM(view_count) as total_views,
       SUM(watch_count) as total_watches
     FROM listings
     WHERE seller_id = $1`,
    [userId]
  );

  return { status: 200, body: { stats: statsResult.rows[0] } };
}

function skuPrice(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function skuQuantity(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

async function saveVariations(listingId, variations, skus, defaults = {}) {
  for (const [i, variation] of variations.entries()) {
    const name = String(variation.name || "").trim();
    if (!name) continue;
    const created = await query(
      `INSERT INTO listing_variations (listing_id, name, position) VALUES ($1,$2,$3) RETURNING id`,
      [listingId, name, i],
    );
    for (const [j, opt] of (variation.options || []).entries()) {
      const value = typeof opt === "object" ? String(opt.value || "").trim() : String(opt).trim();
      const photoUrl = typeof opt === "object" ? opt.photo_url || opt.photo || null : null;
      if (!value) continue;
      await query(
        `INSERT INTO listing_variation_options (variation_id, value, position, photo_url) VALUES ($1,$2,$3,$4)`,
        [created.rows[0].id, value, j, photoUrl],
      );
    }
  }
  const combos = Array.isArray(skus) && skus.length
    ? skus
    : cartesianSkus(variations, defaults);
  for (const sku of combos) {
    const combination = sku.combination && typeof sku.combination === "object" ? sku.combination : sku;
    await query(
      `INSERT INTO listing_variation_skus (listing_id, sku, combination, price, quantity)
       VALUES ($1,$2,$3,$4,$5)`,
      [listingId, sku.sku || null, JSON.stringify(combination), skuPrice(sku.price), skuQuantity(sku.quantity, 0)],
    );
  }
}

async function replaceListingSkus(listingId, skus) {
  const kept = [];
  for (const sku of skus) {
    const combination = sku.combination && typeof sku.combination === "object" ? sku.combination : sku;
    const encoded = JSON.stringify(combination);
    const updated = await query(
      `UPDATE listing_variation_skus
       SET sku = $1, price = $2, quantity = $3, is_active = TRUE
       WHERE listing_id = $4 AND combination = $5::jsonb
       RETURNING id`,
      [sku.sku || null, skuPrice(sku.price), skuQuantity(sku.quantity, 0), listingId, encoded],
    );
    if (updated.rows[0]) {
      kept.push(updated.rows[0].id);
      continue;
    }
    const inserted = await query(
      `INSERT INTO listing_variation_skus (listing_id, sku, combination, price, quantity, is_active)
       VALUES ($1,$2,$3,$4,$5, TRUE) RETURNING id`,
      [listingId, sku.sku || null, encoded, skuPrice(sku.price), skuQuantity(sku.quantity, 0)],
    );
    kept.push(inserted.rows[0].id);
  }
  if (kept.length) {
    await query(
      `UPDATE listing_variation_skus SET is_active = FALSE, quantity = 0
       WHERE listing_id = $1 AND NOT (id = ANY($2::int[]))`,
      [listingId, kept],
    );
  }
}

async function syncListingStockFromSkus(listingId) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(quantity), 0) AS qty, MIN(price) FILTER (WHERE price IS NOT NULL AND price > 0) AS min_price
     FROM listing_variation_skus
     WHERE listing_id = $1 AND is_active = TRUE`,
    [listingId],
  );
  const qty = Number(rows[0]?.qty || 0);
  const minPrice = rows[0]?.min_price == null ? null : Number(rows[0].min_price);
  await query(
    `UPDATE listings
     SET quantity = $1,
         price = COALESCE($2, price),
         updated_at = NOW()
     WHERE id = $3`,
    [qty, minPrice, listingId],
  );
}

async function snapshotListingDraft(listingId, sellerId, draftData) {
  try {
    await query(
      `INSERT INTO listing_drafts (listing_id, seller_id, draft_data)
       VALUES ($1, $2, $3::jsonb)`,
      [listingId, sellerId, JSON.stringify(draftData && typeof draftData === "object" ? draftData : {})],
    );
  } catch {
    // Draft history is best-effort and must not block create/update/publish.
  }
}

function cartesianSkus(variations, defaults = {}) {
  const named = (variations || []).filter((v) => v.name && Array.isArray(v.options) && v.options.length);
  if (!named.length) return [];
  let combos = [{}];
  for (const v of named) {
    const next = [];
    for (const combo of combos) {
      for (const opt of v.options) {
        const value = typeof opt === "object" ? opt.value : opt;
        next.push({ ...combo, [v.name]: value });
      }
    }
    combos = next;
  }
  return combos.map((combination) => ({
    combination,
    quantity: skuQuantity(defaults.quantity, 1),
    price: skuPrice(defaults.price),
  }));
}

async function getRecentlyViewed(userId) {
  const { rows } = await query(
    `SELECT l.id, l.title, l.price, l.format, r.viewed_at,
            (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true LIMIT 1) as primary_photo
     FROM recently_viewed r JOIN listings l ON l.id = r.listing_id
     WHERE r.user_id = $1 ORDER BY r.viewed_at DESC LIMIT 24`,
    [userId],
  );
  return { status: 200, body: { listings: rows.map(cdnifyListing) } };
}

async function listSavedSearches(userId) {
  const { rows } = await query(`SELECT * FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
  return { status: 200, body: { data: rows } };
}

async function createSavedSearch(userId, body) {
  const name = String(body.name || body.query || "Saved search").slice(0, 100);
  const result = await query(
    `INSERT INTO saved_searches (user_id, name, query_params, notify_new_listings, notify_price_drops)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, name, JSON.stringify(body.query_params || body), body.notify_new_listings !== false, Boolean(body.notify_price_drops)],
  );
  return { status: 201, body: { data: result.rows[0] } };
}

async function bulkImportCsv(userId, body) {
  const csv = String(body.csv || body.text || "");
  if (!csv.includes(",")) return { status: 400, body: { error: "Paste a CSV with a header row" } };
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const required = ["title", "description", "category_id", "format"];
  const missing = required.filter((k) => !header.includes(k));
  if (missing.length) return { status: 400, body: { error: `CSV needs columns: ${missing.join(", ")}` } };
  const errors = [];
  let success = 0;
  const batch = await query(
    `INSERT INTO bulk_upload_batches (seller_id, total_rows, status) VALUES ($1,$2,'processing') RETURNING id`,
    [userId, lines.length - 1],
  ).catch(() => ({ rows: [{ id: null }] }));
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const row = Object.fromEntries(header.map((h, idx) => [h, cols[idx]]));
    try {
      const created = await createListing({
        category_id: Number(row.category_id),
        title: row.title,
        description: row.description,
        format: row.format || "fixed",
        price: row.price ? Number(row.price) : null,
        quantity: row.quantity ? Number(row.quantity) : 1,
        condition_id: row.condition_id ? Number(row.condition_id) : null,
        publish_immediately: false,
      }, userId);
      if (created.status >= 400) throw new Error(created.body?.error || "row failed");
      success += 1;
    } catch (err) {
      errors.push({ row: i + 1, error: err.message });
    }
  }
  if (batch.rows[0]?.id) {
    await query(
      `UPDATE bulk_upload_batches SET success_count = $2, error_count = $3, status = 'completed', processed_rows = $2, errors = $4, completed_at = NOW() WHERE id = $1`,
      [batch.rows[0].id, success, errors.length, JSON.stringify(errors)],
    ).catch(() => {});
  }
  return { status: 200, body: { success, errors, batch_id: batch.rows[0]?.id } };
}

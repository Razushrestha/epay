/**
 * Listings API Router
 * Create and manage product listings (fixed price, auctions, variations)
 */

import { query } from './db.mjs';
import { uploadPhoto, deletePhoto, setPrimaryPhoto } from './upload.mjs';
import { enforceVerification, evaluateUser } from './trust.mjs';

/**
 * Main listings router
 */
export async function handleListings(req, method, urlPath, headers, body, ipAddress, userAgent) {
  const url = new URL(`http://localhost${urlPath}`);
  const pathParts = url.pathname.replace('/api/v1/listings', '').split('/').filter(Boolean);

  try {
    // Public endpoints
    if (method === 'GET' && !pathParts[0]) {
      return await getListings(url.searchParams);
    }

    if (method === 'GET' && pathParts[0] && !isNaN(pathParts[0])) {
      return await getListingById(pathParts[0], headers.authorization);
    }

    if (method === 'GET' && pathParts[0] === 'search') {
      return await searchListings(url.searchParams);
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
      return await updateListing(pathParts[0], body, auth.userId);
    }

    if (method === 'DELETE' && pathParts[0] && !isNaN(pathParts[0])) {
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
      return await addToWatchlist(pathParts[0], auth.userId);
    }

    if (method === 'DELETE' && pathParts[0] && pathParts[1] === 'watch') {
      return await removeFromWatchlist(pathParts[0], auth.userId);
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
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
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
      l.created_at, l.published_at,
      c.name as category_name, c.slug as category_slug,
      b.name as brand_name, b.slug as brand_slug,
      (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true LIMIT 1) as primary_photo,
      u.username as seller_username,
      fs.score_percentage as seller_feedback_score
    FROM listings l
    JOIN categories c ON l.category_id = c.id
    LEFT JOIN brands b ON l.brand_id = b.id
    JOIN users u ON l.seller_id = u.id
    LEFT JOIN feedback_scores fs ON fs.user_id = u.id
    WHERE l.status = 'active' AND l.moderation_status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM vacation_mode v
        WHERE v.seller_id = l.seller_id AND v.active = TRUE AND v.hide_listings = TRUE
          AND (v.ends_at IS NULL OR v.ends_at > NOW())
      )
  `;

  const values = [];
  let paramCount = 1;

  if (categoryId) {
    sql += ` AND l.category_id = $${paramCount++}`;
    values.push(categoryId);
  }

  if (brandId) {
    sql += ` AND l.brand_id = $${paramCount++}`;
    values.push(brandId);
  }

  if (format) {
    sql += ` AND l.format = $${paramCount++}`;
    values.push(format);
  }

  if (condition) {
    sql += ` AND l.condition_id = $${paramCount++}`;
    values.push(condition);
  }

  if (seller) {
    sql += ` AND u.username = $${paramCount++}`;
    values.push(seller);
  }

  if (minPrice) {
    sql += ` AND COALESCE(l.price, l.auction_current_price) >= $${paramCount++}`;
    values.push(minPrice);
  }

  if (maxPrice) {
    sql += ` AND COALESCE(l.price, l.auction_current_price) <= $${paramCount++}`;
    values.push(maxPrice);
  }

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
    default:
      sql += ` ORDER BY l.published_at DESC`;
  }

  sql += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
  values.push(limit, offset);

  const result = await query(sql, values);

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM listings WHERE status = 'active' AND moderation_status = 'approved'`
  );

  return {
    status: 200,
    body: {
      listings: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    }
  };
}

/**
 * Get listing by ID
 */
async function getListingById(listingId, authHeader) {
  const result = await query(
    `SELECT 
      l.*,
      c.name as category_name, c.slug as category_slug,
      b.name as brand_name, b.slug as brand_slug,
      cond.name as condition_name, cond.description as condition_description,
      u.id as seller_id, u.username as seller_username, u.email as seller_email,
      up.display_name as seller_full_name, up.avatar_url as seller_avatar,
      fs.score_percentage as seller_feedback_score, fs.positive_count, fs.neutral_count, fs.negative_count,
      (SELECT json_agg(json_build_object(
        'id', p.id, 'url', p.url, 'thumbnail_url', p.thumbnail_url, 
        'position', p.position, 'is_primary', p.is_primary
      ) ORDER BY p.position)
       FROM listing_photos p WHERE p.listing_id = l.id) as photos,
      (SELECT json_agg(json_build_object(
        'id', q.id, 'question', q.question, 'answer', q.answer, 'created_at', q.created_at
      ) ORDER BY q.created_at DESC)
       FROM listing_questions q WHERE q.listing_id = l.id AND q.is_public = true) as questions
    FROM listings l
    JOIN categories c ON l.category_id = c.id
    LEFT JOIN brands b ON l.brand_id = b.id
    LEFT JOIN conditions cond ON l.condition_id = cond.id
    JOIN users u ON l.seller_id = u.id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    LEFT JOIN feedback_scores fs ON fs.user_id = u.id
    WHERE l.id = $1 AND l.status IN ('active', 'sold', 'ended')`,
    [listingId]
  );

  if (!result.rows[0]) {
    return { status: 404, body: { error: 'Listing not found' } };
  }

  const listing = result.rows[0];

  // Track view
  const token = authHeader?.replace('Bearer ', '');
  let userId = null;
  if (token) {
    const auth = await validateToken(token);
    userId = auth?.userId;
  }

  await query(
    `INSERT INTO listing_views (listing_id, user_id, ip_address, user_agent, viewed_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [listingId, userId, null, null]
  );

  await query(
    `UPDATE listings SET view_count = view_count + 1 WHERE id = $1`,
    [listingId]
  );

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
      ts_rank(to_tsvector('english', l.title || ' ' || l.description), plainto_tsquery('english', $1)) as rank
    FROM listings l
    JOIN categories c ON l.category_id = c.id
    JOIN users u ON l.seller_id = u.id
    WHERE l.status = 'active' AND l.moderation_status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM vacation_mode v
        WHERE v.seller_id = l.seller_id AND v.active = TRUE AND v.hide_listings = TRUE
          AND (v.ends_at IS NULL OR v.ends_at > NOW())
      )
      AND to_tsvector('english', l.title || ' ' || l.description) @@ plainto_tsquery('english', $1)
  `;

  const values = [q];
  let paramCount = 2;

  if (categoryId) {
    sql += ` AND l.category_id = $${paramCount++}`;
    values.push(categoryId);
  }

  sql += ` ORDER BY rank DESC, l.published_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
  values.push(limit, offset);

  const result = await query(sql, values);

  return {
    status: 200,
    body: {
      listings: result.rows,
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

  return { status: 200, body: { listings: result.rows } };
}

/**
 * Create listing (seller)
 */
async function createListing(data, userId) {
  const verified = await enforceVerification(userId);
  if (verified) return verified;
  // Verify user is a seller
  const userCheck = await query('SELECT is_seller FROM users WHERE id = $1', [userId]);
  if (!userCheck.rows[0]?.is_seller) {
    return { status: 403, body: { error: 'Seller account required' } };
  }

  const {
    category_id, brand_id, title, subtitle, description, condition_id, condition_description,
    format, price, quantity, auction_start_price, auction_reserve_price, auction_duration,
    allow_best_offer, auto_accept_price, auto_decline_price,
    shipping_free, shipping_cost, shipping_international, shipping_international_cost,
    item_location, sku, upc, specifics, publish_immediately
  } = data;

  if (!category_id || !title || !description || !format) {
    return { status: 400, body: { error: 'Missing required fields: category_id, title, description, format' } };
  }

  const status = publish_immediately ? 'active' : 'draft';
  const publishedAt = publish_immediately ? 'NOW()' : 'NULL';
  const durationHours = Math.max(1, Math.min(720, Number(auction_duration) || 168));
  const startPrice = auction_start_price || price || 0;
  const risk = await evaluateUser(userId, { kind: 'listing', title, description });
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
      auction_starts_at, auction_ends_at, auction_current_price, moderation_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, ${publishedAt},
      ${publish_immediately && (format === 'auction' || format === 'both') ? 'NOW()' : 'NULL'},
      ${publish_immediately && (format === 'auction' || format === 'both') ? `NOW() + INTERVAL '${durationHours} hours'` : 'NULL'},
      $27, $28)
    RETURNING *`,
    [
      userId, category_id, brand_id, title, subtitle, description,
      condition_id, condition_description, format, price, quantity,
      auction_start_price, auction_reserve_price, auction_duration,
      allow_best_offer, auto_accept_price, auto_decline_price,
      shipping_free, shipping_cost, shipping_international, shipping_international_cost,
      item_location, sku, upc, JSON.stringify(specifics || {}), status, startPrice, moderation
    ]
  );
  if (risk.flagged && result.rows[0]) {
    await query(
      `INSERT INTO moderation_queue (item_type, item_id, reason, score) VALUES ('listing', $1, $2, $3)`,
      [String(result.rows[0].id), 'prohibited or velocity', risk.score],
    ).catch(() => {});
  }

  return { status: 201, body: { listing: result.rows[0] } };
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
    'sku', 'upc', 'allow_best_offer', 'auto_accept_price', 'auto_decline_price'
  ];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${paramCount++}`);
      values.push(data[key]);
    }
  }

  if (data.specifics) {
    fields.push(`specifics = $${paramCount++}`);
    values.push(JSON.stringify(data.specifics));
  }

  if (fields.length === 0) {
    return { status: 400, body: { error: 'No valid fields to update' } };
  }

  fields.push(`updated_at = NOW()`);
  values.push(listingId);

  const result = await query(
    `UPDATE listings SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

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

  await query(
    `UPDATE listings SET
       status = 'active',
       published_at = NOW(),
       auction_starts_at = CASE WHEN format IN ('auction','both') THEN COALESCE(auction_starts_at, NOW()) ELSE auction_starts_at END,
       auction_ends_at = CASE WHEN format IN ('auction','both') THEN COALESCE(auction_ends_at, NOW() + (COALESCE(auction_duration, 168) || ' hours')::interval) ELSE auction_ends_at END,
       auction_current_price = CASE WHEN format IN ('auction','both') THEN COALESCE(auction_current_price, auction_start_price, price) ELSE auction_current_price END
     WHERE id = $1`,
    [listingId]
  );

  return { status: 200, body: { success: true } };
}

/**
 * End listing
 */
async function endListing(listingId, userId) {
  const ownerCheck = await query('SELECT seller_id FROM listings WHERE id = $1', [listingId]);
  if (!ownerCheck.rows[0] || ownerCheck.rows[0].seller_id !== userId) {
    return { status: 403, body: { error: 'Not authorized' } };
  }

  await query(
    `UPDATE listings SET status = 'ended', ended_at = NOW() WHERE id = $1`,
    [listingId]
  );

  return { status: 200, body: { success: true } };
}

/**
 * Relist an ended listing
 */
async function relistListing(listingId, userId) {
  const ownerCheck = await query('SELECT seller_id, status FROM listings WHERE id = $1', [listingId]);
  if (!ownerCheck.rows[0] || ownerCheck.rows[0].seller_id !== userId) {
    return { status: 403, body: { error: 'Not authorized' } };
  }

  if (!['ended', 'sold'].includes(ownerCheck.rows[0].status)) {
    return { status: 400, body: { error: 'Only ended or sold listings can be relisted' } };
  }

  await query(
    `UPDATE listings 
     SET status = 'active', published_at = NOW(), ended_at = NULL, 
         auction_bid_count = 0, auction_winner_id = NULL,
         auction_starts_at = CASE WHEN format IN ('auction','both') THEN NOW() ELSE auction_starts_at END,
         auction_ends_at = CASE WHEN format IN ('auction','both') THEN NOW() + (COALESCE(auction_duration, 168) || ' hours')::interval ELSE auction_ends_at END,
         auction_current_price = CASE WHEN format IN ('auction','both') THEN COALESCE(auction_start_price, price, auction_current_price) ELSE auction_current_price END
     WHERE id = $1`,
    [listingId]
  );

  return { status: 200, body: { success: true } };
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
  await query(
    `INSERT INTO watchlist (user_id, listing_id) VALUES ($1, $2)
     ON CONFLICT (user_id, listing_id) DO NOTHING`,
    [userId, listingId]
  );

  await query('UPDATE listings SET watch_count = watch_count + 1 WHERE id = $1', [listingId]);

  return { status: 200, body: { success: true } };
}

/**
 * Remove from watchlist
 */
async function removeFromWatchlist(listingId, userId) {
  const result = await query(
    'DELETE FROM watchlist WHERE user_id = $1 AND listing_id = $2 RETURNING *',
    [userId, listingId]
  );

  if (result.rowCount > 0) {
    await query('UPDATE listings SET watch_count = watch_count - 1 WHERE id = $1', [listingId]);
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

  return { status: 200, body: { listings: result.rows, limit, offset } };
}

/**
 * Ask question on listing
 */
async function askQuestion(listingId, data, userId) {
  const { question } = data;

  if (!question || question.length < 10) {
    return { status: 400, body: { error: 'Question must be at least 10 characters' } };
  }

  const result = await query(
    `INSERT INTO listing_questions (listing_id, asker_id, question)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [listingId, userId, question]
  );

  await query('UPDATE listings SET question_count = question_count + 1 WHERE id = $1', [listingId]);

  return { status: 201, body: { question: result.rows[0] } };
}

/**
 * Answer question (seller)
 */
async function answerQuestion(questionId, data, userId) {
  const { answer } = data;

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

  if (!checkResult.rows[0] || checkResult.rows[0].seller_id !== userId) {
    return { status: 403, body: { error: 'Not authorized' } };
  }

  const result = await query(
    `UPDATE listing_questions 
     SET answer = $1, answered_by = $2, answered_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [answer, userId, questionId]
  );

  return { status: 200, body: { question: result.rows[0] } };
}

/**
 * Get seller listings
 */
async function getSellerListings(userId, params) {
  const status = params.get('status') || 'all';
  const limit = Math.min(parseInt(params.get('limit')) || 50, 200);
  const offset = parseInt(params.get('offset')) || 0;

  let sql = `
    SELECT 
      l.id, l.title, l.format, l.price, l.quantity, l.status,
      l.auction_current_price, l.auction_bid_count, l.view_count, l.watch_count,
      l.created_at, l.published_at,
      c.name as category_name,
      (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true LIMIT 1) as primary_photo
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

  return { status: 200, body: { listings: result.rows, limit, offset } };
}

/**
 * Get seller analytics
 */
async function getSellerAnalytics(userId) {
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

/**
 * Cart & Checkout API Router
 * Multi-seller cart, stock reservations, checkout flow, order creation
 */

import { query, withTx } from './db.mjs';
import { commerceBlock } from './standing.mjs';
import { randomBytes } from 'node:crypto';
import { taxAmount, vatRateForCategory, shippingRateForSeller } from './commerce-rules.mjs';
import { combinedShippingForSeller } from './m2-listings.mjs';
import { donationForCheckout, ensureDonationTables } from './donations.mjs';
import { RESERVE_MINUTES, reservationState, reservedError } from './stock.mjs';

let checkoutSchemaReady;
export function ensureCheckoutSessionTables() {
  if (!checkoutSchemaReady) {
    checkoutSchemaReady = createCheckoutSessionTables().catch((err) => {
      checkoutSchemaReady = null;
      throw err;
    });
  }
  return checkoutSchemaReady;
}

async function createCheckoutSessionTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS checkout_sessions (
      id SERIAL PRIMARY KEY,
      public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
      buyer_id INTEGER NOT NULL REFERENCES users(id),
      total_amount NUMERIC(12,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending_payment',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      paid_at TIMESTAMPTZ
    )
  `);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_session_id INTEGER REFERENCES checkout_sessions(id)`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES users(id)`);
  await query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_session_id INTEGER REFERENCES checkout_sessions(id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_orders_checkout_session ON orders(checkout_session_id)`);
}

function allocateSellerCharges(sellers, totals) {
  const cartSubtotal = Number(totals.subtotal);
  const cartDiscount = Number(totals.discount);
  const cartShipping = Number(totals.shipping);
  const cartTax = Number(totals.tax);
  const cartDonation = Number(totals.donation || 0);
  const rawShipping = sellers.reduce((sum, seller) => sum + Number(seller.shipping_cost || 0), 0);
  const shippingScale = rawShipping > 0 ? cartShipping / rawShipping : 0;
  const rows = sellers.map((seller, index) => {
    const subtotal = Number(seller.subtotal);
    const share = cartSubtotal > 0 ? subtotal / cartSubtotal : 1 / sellers.length;
    return {
      seller,
      subtotal,
      discount: +(cartDiscount * share).toFixed(2),
      shipping: +(Number(seller.shipping_cost || 0) * shippingScale).toFixed(2),
      tax: +(cartTax * share).toFixed(2),
      donation: index === sellers.length - 1 ? 0 : +(cartDonation * share).toFixed(2),
    };
  });
  const used = rows.slice(0, -1).reduce(
    (sum, row) => ({
      discount: sum.discount + row.discount,
      shipping: sum.shipping + row.shipping,
      tax: sum.tax + row.tax,
      donation: sum.donation + row.donation,
    }),
    { discount: 0, shipping: 0, tax: 0, donation: 0 },
  );
  const last = rows[rows.length - 1];
  last.discount = +(cartDiscount - used.discount).toFixed(2);
  last.shipping = +(cartShipping - used.shipping).toFixed(2);
  last.tax = +(cartTax - used.tax).toFixed(2);
  last.donation = +(cartDonation - used.donation).toFixed(2);
  for (const row of rows) {
    row.total = +(row.subtotal - row.discount + row.shipping + row.tax + row.donation).toFixed(2);
  }
  return rows;
}

function availableStockMessage(available) {
  return `Only ${Number(available) || 0} items available in stock`;
}

function insufficientStock(available) {
  const n = Number(available) || 0;
  return { status: 400, body: { error: availableStockMessage(n), available: n } };
}

async function stockForListing(listingId, variationSkuId) {
  if (variationSkuId) {
    const result = await query(
      `SELECT v.quantity AS stock
       FROM listing_variation_skus v
       JOIN listings l ON l.id = v.listing_id
       WHERE v.id = $1 AND l.id = $2`,
      [variationSkuId, listingId],
    );
    return result.rows[0] ? Number(result.rows[0].stock) : 0;
  }
  const result = await query(`SELECT quantity AS stock FROM listings WHERE id = $1`, [listingId]);
  return result.rows[0] ? Number(result.rows[0].stock) : 0;
}

async function firstCartStockError(userId, sessionId) {
  const cartResult = await getCart(userId, sessionId);
  if (cartResult.status !== 200) return { cartResult, stockError: null };
  for (const seller of cartResult.body.sellers) {
    for (const item of seller.items) {
      const state = await reservationState(item.listing_id, item.variation_sku_id, userId);
      if (item.quantity > state.available) {
        return {
          cartResult,
          stockError: state.temporarily_unavailable ? reservedError() : insufficientStock(state.available),
        };
      }
    }
  }
  return { cartResult, stockError: null };
}

/**
 * Main cart & checkout router
 */
export async function handleCart(req, method, urlPath, headers, body, ipAddress, userAgent) {
  const url = new URL(`http://localhost${urlPath}`);
  const pathParts = url.pathname.replace('/api/v1/cart', '').split('/').filter(Boolean);

  try {
    await ensureDonationTables();
    await ensureCheckoutSessionTables();
    // Get user/session ID
    const token = headers.authorization?.replace('Bearer ', '');
    const auth = token ? await validateToken(token) : null;
    const userId = auth?.userId || null;
    const sessionId = headers['x-session-id'] || req.headers['x-session-id'] || generateSessionId();
    if (userId && sessionId) {
      await mergeGuestCart(userId, sessionId);
    }

    // Cart endpoints
    if (method === 'GET' && !pathParts[0]) {
      return await getCart(userId, sessionId);
    }

    if (method === 'POST' && !pathParts[0]) {
      return await addToCart(body, userId, sessionId);
    }

    if (method === 'PATCH' && pathParts[0] && !isNaN(pathParts[0])) {
      return await updateCartItem(pathParts[0], body, userId, sessionId);
    }

    if (method === 'DELETE' && pathParts[0] && !isNaN(pathParts[0])) {
      return await removeFromCart(pathParts[0], userId, sessionId);
    }

    if (method === 'DELETE' && pathParts[0] === 'clear') {
      return await clearCart(userId, sessionId);
    }

    if (method === 'POST' && pathParts[0] === 'validate') {
      return await validateCart(userId, sessionId);
    }

    // Checkout endpoints
    if (method === 'POST' && pathParts[0] === 'checkout' && pathParts[1] === 'reserve') {
      return await reserveStock(userId, sessionId);
    }

    if (method === 'POST' && pathParts[0] === 'checkout' && pathParts[1] === 'calculate') {
      return await calculateCheckoutTotals(body, userId, sessionId);
    }

    if (method === 'POST' && pathParts[0] === 'checkout' && pathParts[1] === 'apply-coupon') {
      return await applyCoupon(body, userId, sessionId);
    }

    if (method === 'POST' && pathParts[0] === 'checkout' && pathParts[1] === 'create-order') {
      if (!userId) {
        return { status: 401, body: { error: 'Login required to place order' } };
      }
      return await createOrder(body, userId, sessionId, ipAddress, userAgent);
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    console.error('Cart API error:', error);
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
    `SELECT u.id as user_id, u.email FROM auth_sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
    [hash]
  );

  const row = result.rows[0];
  if (!row) return null;
  return { ...row, userId: Number(row.user_id), user_id: Number(row.user_id) };
}

/**
 * Generate session ID for guest users
 */
function generateSessionId() {
  return randomBytes(16).toString('hex');
}

async function mergeGuestCart(userId, sessionId) {
  await query(
    `UPDATE cart_items SET user_id = $1
     WHERE session_id = $2 AND (user_id IS NULL OR user_id = $1)`,
    [userId, sessionId]
  );
}

/**
 * Add item to cart
 */
async function addToCart(data, userId, sessionId) {
  const { listing_id, variation_sku_id, quantity = 1 } = data;

  if (!listing_id) {
    return { status: 400, body: { error: 'listing_id is required' } };
  }

  if (!variation_sku_id) {
    const hasSkus = await query(
      `SELECT 1 FROM listing_variation_skus WHERE listing_id = $1 AND is_active = TRUE LIMIT 1`,
      [listing_id],
    );
    if (hasSkus.rows[0]) {
      return { status: 400, body: { error: 'Select a size or color before adding to cart' } };
    }
  }

  // Get listing details and check stock
  let stockQuery, stockParams;
  if (variation_sku_id) {
    stockQuery = `
      SELECT l.id, l.seller_id, l.title, l.status, v.price, v.quantity as stock
      FROM listings l
      JOIN listing_variation_skus v ON v.listing_id = l.id
      WHERE l.id = $1 AND v.id = $2 AND l.status = 'active'
    `;
    stockParams = [listing_id, variation_sku_id];
  } else {
    stockQuery = `
      SELECT id, seller_id, title, status, price, quantity as stock
      FROM listings
      WHERE id = $1 AND status = 'active'
    `;
    stockParams = [listing_id];
  }

  const listingResult = await query(stockQuery, stockParams);
  if (!listingResult.rows[0]) {
    return { status: 404, body: { error: 'Listing not found or unavailable' } };
  }

  const listing = listingResult.rows[0];
  const availability = await reservationState(listing_id, variation_sku_id || null, userId);
  if (availability.temporarily_unavailable) {
    return reservedError();
  }
  if (availability.available < quantity) {
    return insufficientStock(availability.available);
  }

  // Check if item already in cart
  const existingResult = await query(
    `SELECT id, quantity FROM cart_items
     WHERE (user_id = $1 OR session_id = $2)
       AND listing_id = $3
       AND (variation_sku_id = $4 OR (variation_sku_id IS NULL AND $4 IS NULL))`,
    [userId, sessionId, listing_id, variation_sku_id]
  );

  if (existingResult.rows[0]) {
    // Update quantity
    const newQuantity = existingResult.rows[0].quantity + quantity;
    if (newQuantity > availability.available) {
      return availability.temporarily_unavailable ? reservedError() : insufficientStock(availability.available);
    }

    await query(
      `UPDATE cart_items SET quantity = $1, updated_at = NOW()
       WHERE id = $2`,
      [newQuantity, existingResult.rows[0].id]
    );
  } else {
    // Insert new cart item
    await query(
      `INSERT INTO cart_items (user_id, session_id, listing_id, variation_sku_id, quantity, price_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, sessionId, listing_id, variation_sku_id, quantity, listing.price]
    );
  }

  return { status: 200, body: { success: true, message: 'Item added to cart' } };
}

/**
 * Get cart with items grouped by seller
 */
async function getCart(userId, sessionId) {
  const result = await query(
    `SELECT 
      c.id as cart_item_id,
      c.quantity,
      c.price_snapshot,
      l.id as listing_id,
      l.title,
      l.seller_id,
      l.price as current_price,
      l.quantity as stock,
      l.shipping_free,
      l.shipping_cost,
      l.shipping_additional,
      u.username as seller_username,
      COALESCE(NULLIF(up.display_name, ''), NULLIF(u.username, ''), split_part(u.email, '@', 1)) as seller_display,
      v.id as variation_sku_id,
      v.combination as variation_combo,
      (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true LIMIT 1) as photo_url
    FROM cart_items c
    JOIN listings l ON c.listing_id = l.id
    JOIN users u ON l.seller_id = u.id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    LEFT JOIN listing_variation_skus v ON c.variation_sku_id = v.id
    WHERE (c.user_id = $1 OR c.session_id = $2)
      AND l.status = 'active'
    ORDER BY c.added_at DESC`,
    [userId, sessionId]
  );

  // Group by seller
  const sellers = {};
  let totalItems = 0;
  let subtotal = 0;

  for (const item of result.rows) {
    if (!sellers[item.seller_id]) {
      sellers[item.seller_id] = {
        seller_id: item.seller_id,
        seller_username: item.seller_username,
        seller_display: item.seller_display || item.seller_username || `Seller ${item.seller_id}`,
        items: [],
        subtotal: 0,
        shipping_cost: 0
      };
    }

    const itemTotal = item.price_snapshot * item.quantity;
    const availability = await reservationState(item.listing_id, item.variation_sku_id, userId);
    sellers[item.seller_id].items.push({
      cart_item_id: item.cart_item_id,
      listing_id: item.listing_id,
      title: item.title,
      variation_sku_id: item.variation_sku_id,
      variation_combo: item.variation_combo,
      photo_url: item.photo_url,
      quantity: item.quantity,
      price: item.price_snapshot,
      current_price: item.current_price,
      price_changed: item.price_snapshot !== item.current_price,
      stock: availability.available,
      in_stock: availability.available >= item.quantity,
      reserved: availability.temporarily_unavailable,
      reserved_until: availability.reserved_until,
      subtotal: itemTotal,
      shipping_free: item.shipping_free,
      shipping_cost: item.shipping_cost,
      shipping_additional: item.shipping_additional,
    });

    sellers[item.seller_id].subtotal += itemTotal;

    totalItems += item.quantity;
    subtotal += itemTotal;
  }

  const sellersArray = Object.values(sellers);
  for (const seller of sellersArray) {
    const combined = combinedShippingForSeller(seller.items);
    const rate = await shippingRateForSeller(seller.seller_id, seller.subtotal, combined.shipping_cost);
    seller.shipping_cost = combined.combined ? combined.shipping_cost : rate;
    seller.combined_shipping = combined.combined;
    seller.shipping_note = combined.note;
  }
  const totalShipping = sellersArray.reduce((sum, s) => sum + s.shipping_cost, 0);

  return {
    status: 200,
    body: {
      session_id: sessionId,
      items: result.rows,
      sellers: sellersArray,
      summary: {
        total_items: totalItems,
        subtotal: subtotal.toFixed(2),
        shipping: totalShipping.toFixed(2),
        tax: 0, // Calculated at checkout
        total: (subtotal + totalShipping).toFixed(2)
      }
    }
  };
}

/**
 * Update cart item quantity
 */
async function updateCartItem(cartItemId, data, userId, sessionId) {
  const { quantity } = data;

  if (!quantity || quantity < 1) {
    return { status: 400, body: { error: 'Quantity must be at least 1' } };
  }

  // Verify ownership and check stock
  const result = await query(
    `SELECT c.id, c.listing_id, c.variation_sku_id, l.quantity as stock, v.quantity as var_stock
     FROM cart_items c
     JOIN listings l ON c.listing_id = l.id
     LEFT JOIN listing_variation_skus v ON c.variation_sku_id = v.id
     WHERE c.id = $1 AND (c.user_id = $2 OR c.session_id = $3)`,
    [cartItemId, userId, sessionId]
  );

  if (!result.rows[0]) {
    return { status: 404, body: { error: 'Cart item not found' } };
  }

  const item = result.rows[0];
  const availability = await reservationState(item.listing_id, item.variation_sku_id, userId);
  if (quantity > availability.available) {
    return availability.temporarily_unavailable ? reservedError() : insufficientStock(availability.available);
  }

  await query(
    `UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2`,
    [quantity, cartItemId]
  );

  return { status: 200, body: { success: true } };
}

/**
 * Remove item from cart
 */
async function removeFromCart(cartItemId, userId, sessionId) {
  await query(
    `DELETE FROM cart_items
     WHERE id = $1 AND (user_id = $2 OR session_id = $3)`,
    [cartItemId, userId, sessionId]
  );

  return { status: 200, body: { success: true } };
}

/**
 * Clear entire cart
 */
async function clearCart(userId, sessionId) {
  await query(
    `DELETE FROM cart_items WHERE user_id = $1 OR session_id = $2`,
    [userId, sessionId]
  );

  return { status: 200, body: { success: true } };
}

/**
 * Validate cart (check stock availability, price changes)
 */
async function validateCart(userId, sessionId) {
  const cartResult = await getCart(userId, sessionId);
  if (cartResult.status !== 200) return cartResult;

  const issues = [];
  for (const seller of cartResult.body.sellers) {
    for (const item of seller.items) {
      if (item.reserved) {
        issues.push({
          cart_item_id: item.cart_item_id,
          type: 'reserved',
          available: item.stock,
          message: reservedError().body.error,
        });
      } else if (!item.in_stock) {
        issues.push({
          cart_item_id: item.cart_item_id,
          type: 'out_of_stock',
          available: item.stock,
          message: availableStockMessage(item.stock),
        });
      }
      if (item.price_changed) {
        issues.push({
          cart_item_id: item.cart_item_id,
          type: 'price_changed',
          message: `${item.title} - Price changed from NPR ${item.price} to NPR ${item.current_price}`
        });
      }
    }
  }

  return {
    status: 200,
    body: {
      valid: issues.length === 0,
      issues
    }
  };
}

/**
 * Reserve stock for 15 minutes during checkout
 */
async function reserveStock(userId, sessionId) {
  if (!userId) {
    return { status: 401, body: { error: 'Login required to checkout' } };
  }

  try {
    return await withTx(async (client) => {
      const cartResult = await client.query(
        `SELECT listing_id, variation_sku_id, quantity
         FROM cart_items
         WHERE user_id = $1 OR session_id = $2`,
        [userId, sessionId],
      );

      if (cartResult.rows.length === 0) {
        return { status: 400, body: { error: 'Cart is empty' } };
      }

      const expiresAt = new Date(Date.now() + RESERVE_MINUTES * 60 * 1000);
      const reservationIds = [];

      for (const item of cartResult.rows) {
        await client.query(`SELECT id FROM listings WHERE id = $1 FOR UPDATE`, [item.listing_id]);
        if (item.variation_sku_id) {
          await client.query(`SELECT id FROM listing_variation_skus WHERE id = $1 FOR UPDATE`, [item.variation_sku_id]);
        }

        const state = await reservationState(item.listing_id, item.variation_sku_id, userId, client);
        if (item.quantity > state.available) {
          const error = new Error('RESERVE_UNAVAILABLE');
          error.payload = state.temporarily_unavailable ? reservedError() : insufficientStock(state.available);
          throw error;
        }

        await client.query(
          `DELETE FROM stock_reservations
           WHERE reserved_by_user_id = $1
             AND listing_id = $2
             AND variation_sku_id IS NOT DISTINCT FROM $3
             AND released_at IS NULL`,
          [userId, item.listing_id, item.variation_sku_id],
        );

        const inserted = await client.query(
          `INSERT INTO stock_reservations
             (listing_id, variation_sku_id, quantity, reserved_by_user_id, reserved_by_session_id, expires_at)
           SELECT $1::int, $2::int, $3::int, $4::int, $5::text, $6::timestamptz
           WHERE (
             COALESCE((SELECT l.quantity FROM listings l WHERE l.id = $1::int), 0)
             - COALESCE((
                 SELECT SUM(r.quantity)::int FROM stock_reservations r
                 WHERE r.listing_id = $1::int
                   AND r.released_at IS NULL
                   AND r.expires_at > NOW()
                   AND r.variation_sku_id IS NOT DISTINCT FROM $2::int
                   AND r.reserved_by_user_id IS DISTINCT FROM $4::int
               ), 0)
           ) >= $3::int
           RETURNING id`,
          [item.listing_id, item.variation_sku_id, item.quantity, userId, sessionId, expiresAt],
        );
        if (!inserted.rows[0]) {
          const error = new Error('RESERVE_UNAVAILABLE');
          error.payload = reservedError();
          throw error;
        }
        reservationIds.push(inserted.rows[0].id);
      }

      return {
        status: 200,
        body: {
          success: true,
          reservation_ids: reservationIds,
          expires_at: expiresAt.toISOString(),
          reserved_minutes: RESERVE_MINUTES,
        },
      };
    });
  } catch (error) {
    if (error?.payload) return error.payload;
    throw error;
  }
}

/**
 * Calculate checkout totals (tax + shipping)
 */
async function calculateCheckoutTotals(data, userId, sessionId) {
  const { shipping_address_id, coupon_code } = data;

  // Get cart
  const cartResult = await getCart(userId, sessionId);
  if (cartResult.status !== 200) return cartResult;

  const cart = cartResult.body;
  let subtotal = parseFloat(cart.summary.subtotal);
  let shipping = parseFloat(cart.summary.shipping);
  let discount = 0;
  let merchandiseDiscount = 0;

  // Apply coupon if provided
  if (coupon_code) {
    const couponResult = await query(
      `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)`,
      [coupon_code]
    );

    if (!couponResult.rows[0]) {
      return { status: 400, body: { error: 'Invalid coupon code' } };
    }

    {
      const coupon = couponResult.rows[0];

      if (!coupon.is_active) {
        return { status: 400, body: { error: 'Invalid coupon code' } };
      }

      if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
        return { status: 400, body: { error: 'Invalid coupon code' } };
      }

      if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) {
        return { status: 400, body: { error: 'Coupon has expired' } };
      }

      if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
        return { status: 400, body: { error: 'Coupon usage limit reached' } };
      }

      const minPurchase = coupon.min_purchase != null ? Number(coupon.min_purchase) : 0;
      if (minPurchase > 0 && subtotal < minPurchase) {
        const minLabel = minPurchase.toLocaleString('en-US', { maximumFractionDigits: 0 });
        return { status: 400, body: { error: `Minimum purchase of NPR ${minLabel} required` } };
      }

      // Calculate discount
      if (coupon.type === 'percent') {
        discount = (subtotal * coupon.value / 100);
        if (coupon.max_discount) {
          discount = Math.min(discount, coupon.max_discount);
        }
        merchandiseDiscount = discount;
      } else if (coupon.type === 'fixed_amount') {
        discount = Math.min(coupon.value, subtotal);
        merchandiseDiscount = discount;
      } else if (coupon.type === 'free_shipping') {
        discount = shipping;
        shipping = 0;
      }
    }
  }

  const taxableAmount = Math.max(0, subtotal - merchandiseDiscount + shipping);
  const vatRate = await vatRateForCategory(null);
  const tax = taxAmount(taxableAmount, vatRate);

  const merchandise = subtotal - merchandiseDiscount + shipping + tax;
  const donation = await donationForCheckout(userId, data.donate, merchandise);
  const total = merchandise + donation.amount;

  return {
    status: 200,
    body: {
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      shipping: shipping.toFixed(2),
      tax: tax.toFixed(2),
      donation: donation.amount.toFixed(2),
      donation_charity: donation.charity,
      total: total.toFixed(2)
    }
  };
}

/**
 * Apply coupon code
 */
async function applyCoupon(data, userId, sessionId) {
  const { coupon_code } = data;

  if (!coupon_code) {
    return { status: 400, body: { error: 'coupon_code is required' } };
  }

  return await calculateCheckoutTotals({ coupon_code }, userId, sessionId);
}

/**
 * Create order from cart
 */
export async function createOrder(data, userId, sessionId, ipAddress, userAgent) {
  await ensureCheckoutSessionTables();
  const blocked = await commerceBlock(userId);
  if (blocked) return blocked;
  const { shipping_address_id, billing_address_id, buyer_notes, coupon_code, donate } = data;

  if (!shipping_address_id) {
    return { status: 400, body: { error: 'shipping_address_id is required' } };
  }

  // Get cart and refuse checkout when stock was sold to another buyer
  const stockCheck = await firstCartStockError(userId, sessionId);
  if (stockCheck.cartResult.status !== 200) return stockCheck.cartResult;
  if (stockCheck.stockError) return stockCheck.stockError;
  const cartResult = stockCheck.cartResult;
  if (cartResult.body.sellers.length === 0) {
    return { status: 400, body: { error: 'Cart is empty' } };
  }

  // Calculate totals
  const totalsResult = await calculateCheckoutTotals({ coupon_code, donate }, userId, sessionId);
  if (totalsResult.status !== 200) return totalsResult;

  const totals = totalsResult.body;

  const addressResult = await query(
    `SELECT * FROM addresses
     WHERE user_id = $2 AND (public_id::text = $1 OR id::text = $1)
     LIMIT 1`,
    [String(shipping_address_id), userId]
  );

  if (!addressResult.rows[0]) {
    return { status: 404, body: { error: 'Shipping address not found' } };
  }

  const address = addressResult.rows[0];
  const shipName = address.full_name || address.recipient_name;
  const shipLine1 = address.line1 || address.address_line1;
  const shipLine2 = address.line2 || address.address_line2 || null;
  const shipRegion = address.region || address.state || null;

  let couponId = null;
  if (coupon_code) {
    const couponResult = await query('SELECT id FROM coupons WHERE code = $1', [coupon_code]);
    couponId = couponResult.rows[0]?.id || null;
  }

  const sellerCharges = allocateSellerCharges(cartResult.body.sellers, totals);

  const created = await withTx(async (client) => {
    const session = await client.query(
      `INSERT INTO checkout_sessions (buyer_id, total_amount, status)
       VALUES ($1, $2, 'pending_payment')
       RETURNING id, public_id, total_amount`,
      [userId, totals.total],
    );
    const sessionId = session.rows[0].id;
    const orders = [];

    for (const [index, charge] of sellerCharges.entries()) {
      const orderNumber = await generateOrderNumber(client);
      const orderResult = await client.query(
        `INSERT INTO orders (
          order_number, buyer_id, seller_id, checkout_session_id, status, subtotal, tax_amount, shipping_amount,
          discount_amount, total_amount, coupon_id, coupon_code,
          shipping_address_id, shipping_name, shipping_phone, shipping_address_line1,
          shipping_address_line2, shipping_city, shipping_state, shipping_postal_code,
          billing_address_id, buyer_notes, donation_amount, donation_charity_id
        ) VALUES ($1, $2, $3, $4, 'pending_payment', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        RETURNING id, order_number, seller_id, total_amount, checkout_session_id`,
        [
          orderNumber, userId, charge.seller.seller_id, sessionId,
          charge.subtotal.toFixed(2), charge.tax.toFixed(2), charge.shipping.toFixed(2),
          charge.discount.toFixed(2), charge.total.toFixed(2),
          index === 0 ? couponId : null, index === 0 ? coupon_code : null,
          address.id, shipName, address.phone, shipLine1,
          shipLine2, address.city, shipRegion, address.postal_code,
          address.id, buyer_notes, charge.donation, index === 0 ? totals.donation_charity?.id || null : null,
        ],
      );
      const order = orderResult.rows[0];
      orders.push(order);

      for (const item of charge.seller.items) {
        const itemShare = charge.seller.items.length || 1;
        const itemTax = +(charge.tax / itemShare).toFixed(2);
        const itemShip = +(charge.shipping / itemShare).toFixed(2);
        const itemTotal = +(Number(item.subtotal) + itemTax + itemShip).toFixed(2);
        await client.query(
          `INSERT INTO order_items (
            order_id, listing_id, variation_sku_id, seller_id, title, sku,
            quantity, price, subtotal, tax_amount, shipping_amount, total_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            order.id, item.listing_id, item.variation_sku_id, charge.seller.seller_id,
            item.title, null, item.quantity, item.price, item.subtotal,
            itemTax, itemShip, itemTotal,
          ],
        );
        if (item.variation_sku_id) {
          await client.query(
            `UPDATE listing_variation_skus SET quantity = quantity - $1 WHERE id = $2`,
            [item.quantity, item.variation_sku_id],
          );
        } else {
          await client.query(
            `UPDATE listings SET quantity = quantity - $1 WHERE id = $2`,
            [item.quantity, item.listing_id],
          );
        }
      }

      await client.query(
        `INSERT INTO order_history (order_id, status_to, changed_by, notes)
         VALUES ($1, 'pending_payment', $2, $3)`,
        [order.id, userId, `Order created for seller ${charge.seller.seller_id}`],
      );
    }

    await client.query(
      `UPDATE stock_reservations
       SET released_at = NOW(), order_id = $1
       WHERE reserved_by_user_id = $2 AND released_at IS NULL`,
      [orders[0].id, userId],
    );

    if (couponId) {
      await client.query(
        `INSERT INTO coupon_usages (coupon_id, user_id, order_id, discount_amount)
         VALUES ($1, $2, $3, $4)`,
        [couponId, userId, orders[0].id, totals.discount],
      );
      await client.query('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1', [couponId]);
    }

    return { session: session.rows[0], orders };
  });

  return {
    status: 201,
    body: {
      success: true,
      order_id: created.orders[0].id,
      order_number: created.orders[0].order_number,
      order_ids: created.orders.map((row) => row.id),
      orders: created.orders,
      checkout_session_id: created.session.id,
      checkout_session_public_id: created.session.public_id,
      total: totals.total,
      message: 'Order created successfully. Please complete payment.'
    }
  };
}

/**
 * Generate unique order number
 */
async function generateOrderNumber(client = null) {
  const run = client ? client.query.bind(client) : query;
  const year = new Date().getFullYear();
  if (client) {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('nexlo_order_number'))`);
  }
  const result = await run(
    `SELECT COUNT(*) as count FROM orders WHERE order_number LIKE $1`,
    [`ORD-${year}-%`]
  );
  const count = parseInt(result.rows[0].count) + 1;
  return `ORD-${year}-${String(count).padStart(6, '0')}`;
}

/**
 * Cart & Checkout API Router
 * Multi-seller cart, stock reservations, checkout flow, order creation
 */

import { query } from './db.mjs';
import { randomBytes } from 'node:crypto';
import { taxAmount, vatRateForCategory, shippingRateForSeller } from './commerce-rules.mjs';

/**
 * Main cart & checkout router
 */
export async function handleCart(req, method, urlPath, headers, body, ipAddress, userAgent) {
  const url = new URL(`http://localhost${urlPath}`);
  const pathParts = url.pathname.replace('/api/v1/cart', '').split('/').filter(Boolean);

  try {
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
  if (listing.stock < quantity) {
    return { status: 400, body: { error: 'Insufficient stock', available: listing.stock } };
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
    if (newQuantity > listing.stock) {
      return { status: 400, body: { error: 'Insufficient stock', available: listing.stock } };
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
      u.username as seller_username,
      v.id as variation_sku_id,
      v.combination as variation_combo,
      (SELECT url FROM listing_photos WHERE listing_id = l.id AND is_primary = true LIMIT 1) as photo_url
    FROM cart_items c
    JOIN listings l ON c.listing_id = l.id
    JOIN users u ON l.seller_id = u.id
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
        items: [],
        subtotal: 0,
        shipping_cost: 0
      };
    }

    const itemTotal = item.price_snapshot * item.quantity;
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
      stock: item.stock,
      in_stock: item.stock >= item.quantity,
      subtotal: itemTotal
    });

    sellers[item.seller_id].subtotal += itemTotal;
    
    // Calculate shipping (take highest if multiple items from same seller)
    if (!item.shipping_free && item.shipping_cost) {
      sellers[item.seller_id].shipping_cost = Math.max(
        sellers[item.seller_id].shipping_cost,
        parseFloat(item.shipping_cost)
      );
    }

    totalItems += item.quantity;
    subtotal += itemTotal;
  }

  const sellersArray = Object.values(sellers);
  for (const seller of sellersArray) {
    seller.shipping_cost = await shippingRateForSeller(seller.seller_id, seller.subtotal, seller.shipping_cost);
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
  const availableStock = item.var_stock !== null ? item.var_stock : item.stock;

  if (quantity > availableStock) {
    return { status: 400, body: { error: 'Insufficient stock', available: availableStock } };
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
      if (!item.in_stock) {
        issues.push({
          cart_item_id: item.cart_item_id,
          type: 'out_of_stock',
          message: `${item.title} - Only ${item.stock} available, you have ${item.quantity} in cart`
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

  // Get cart items
  const cartResult = await query(
    `SELECT listing_id, variation_sku_id, quantity
     FROM cart_items
     WHERE user_id = $1 OR session_id = $2`,
    [userId, sessionId]
  );

  if (cartResult.rows.length === 0) {
    return { status: 400, body: { error: 'Cart is empty' } };
  }

  // Reserve each item (15 minutes)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  const reservationIds = [];

  for (const item of cartResult.rows) {
    const result = await query(
      `INSERT INTO stock_reservations 
         (listing_id, variation_sku_id, quantity, reserved_by_user_id, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [item.listing_id, item.variation_sku_id, item.quantity, userId, expiresAt]
    );
    reservationIds.push(result.rows[0].id);
  }

  return {
    status: 200,
    body: {
      success: true,
      reservation_ids: reservationIds,
      expires_at: expiresAt.toISOString()
    }
  };
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

  // Apply coupon if provided
  if (coupon_code) {
    const couponResult = await query(
      `SELECT * FROM coupons
       WHERE code = $1 AND is_active = true
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [coupon_code]
    );

    if (couponResult.rows[0]) {
      const coupon = couponResult.rows[0];
      
      // Check usage limits
      if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
        return { status: 400, body: { error: 'Coupon usage limit reached' } };
      }

      // Check min purchase
      if (coupon.min_purchase && subtotal < coupon.min_purchase) {
        return { status: 400, body: { error: `Minimum purchase of NPR ${coupon.min_purchase} required` } };
      }

      // Calculate discount
      if (coupon.type === 'percent') {
        discount = (subtotal * coupon.value / 100);
        if (coupon.max_discount) {
          discount = Math.min(discount, coupon.max_discount);
        }
      } else if (coupon.type === 'fixed_amount') {
        discount = Math.min(coupon.value, subtotal);
      } else if (coupon.type === 'free_shipping') {
        discount = shipping;
        shipping = 0;
      }
    }
  }

  const taxableAmount = subtotal - discount;
  const vatRate = await vatRateForCategory(null);
  const tax = taxAmount(taxableAmount, vatRate);

  const total = subtotal - discount + shipping + tax;

  return {
    status: 200,
    body: {
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      shipping: shipping.toFixed(2),
      tax: tax.toFixed(2),
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
async function createOrder(data, userId, sessionId, ipAddress, userAgent) {
  const { shipping_address_id, billing_address_id, buyer_notes, coupon_code } = data;

  if (!shipping_address_id) {
    return { status: 400, body: { error: 'shipping_address_id is required' } };
  }

  // Get cart
  const cartResult = await getCart(userId, sessionId);
  if (cartResult.status !== 200 || cartResult.body.sellers.length === 0) {
    return { status: 400, body: { error: 'Cart is empty' } };
  }

  // Calculate totals
  const totalsResult = await calculateCheckoutTotals({ coupon_code }, userId, sessionId);
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

  // Generate order number
  const orderNumber = await generateOrderNumber();

  // Get coupon ID if provided
  let couponId = null;
  if (coupon_code) {
    const couponResult = await query('SELECT id FROM coupons WHERE code = $1', [coupon_code]);
    couponId = couponResult.rows[0]?.id || null;
  }

  // Create order
  const orderResult = await query(
    `INSERT INTO orders (
      order_number, buyer_id, status, subtotal, tax_amount, shipping_amount, 
      discount_amount, total_amount, coupon_id, coupon_code,
      shipping_address_id, shipping_name, shipping_phone, shipping_address_line1,
      shipping_address_line2, shipping_city, shipping_state, shipping_postal_code,
      billing_address_id, buyer_notes
    ) VALUES ($1, $2, 'pending_payment', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    RETURNING id, order_number`,
    [
      orderNumber, userId, totals.subtotal, totals.tax, totals.shipping,
      totals.discount, totals.total, couponId, coupon_code,
      address.id, shipName, address.phone, shipLine1,
      shipLine2, address.city, shipRegion, address.postal_code,
      address.id, buyer_notes
    ]
  );

  const orderId = orderResult.rows[0].id;

  // Create order items from cart
  for (const seller of cartResult.body.sellers) {
    for (const item of seller.items) {
      const itemTax = (item.subtotal * 0.13);
      const itemTotal = item.subtotal + itemTax + (seller.shipping_cost / seller.items.length);

      await query(
        `INSERT INTO order_items (
          order_id, listing_id, variation_sku_id, seller_id, title, sku,
          quantity, price, subtotal, tax_amount, shipping_amount, total_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          orderId, item.listing_id, item.variation_sku_id, seller.seller_id,
          item.title, null, item.quantity, item.price, item.subtotal,
          itemTax, seller.shipping_cost / seller.items.length, itemTotal
        ]
      );

      // Reduce listing quantity
      if (item.variation_sku_id) {
        await query(
          `UPDATE listing_variation_skus SET quantity = quantity - $1 WHERE id = $2`,
          [item.quantity, item.variation_sku_id]
        );
      } else {
        await query(
          `UPDATE listings SET quantity = quantity - $1 WHERE id = $2`,
          [item.quantity, item.listing_id]
        );
      }
    }
  }

  // Clear cart
  await clearCart(userId, sessionId);

  // Record coupon usage
  if (couponId) {
    await query(
      `INSERT INTO coupon_usages (coupon_id, user_id, order_id, discount_amount)
       VALUES ($1, $2, $3, $4)`,
      [couponId, userId, orderId, totals.discount]
    );
    await query('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1', [couponId]);
  }

  // Order history
  await query(
    `INSERT INTO order_history (order_id, status_to, changed_by, notes)
     VALUES ($1, 'pending_payment', $2, 'Order created')`,
    [orderId, userId]
  );

  return {
    status: 201,
    body: {
      success: true,
      order_id: orderId,
      order_number: orderNumber,
      total: totals.total,
      message: 'Order created successfully. Please complete payment.'
    }
  };
}

/**
 * Generate unique order number
 */
async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const result = await query(
    `SELECT COUNT(*) as count FROM orders WHERE order_number LIKE $1`,
    [`ORD-${year}-%`]
  );
  const count = parseInt(result.rows[0].count) + 1;
  return `ORD-${year}-${String(count).padStart(6, '0')}`;
}

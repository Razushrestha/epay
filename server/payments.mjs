/**
 * Payment Gateway Integration
 * eSewa and Khalti payment processing for Nepal
 */

import { query } from './db.mjs';
import { createHash, createHmac } from 'node:crypto';
import { onOrderPaid } from './ledger.mjs';
import { parseGatewayPid, publicApi, publicFrontend } from './public-urls.mjs';

async function markOrderPaid(orderNumber, notes) {
  const current = await query(
    `UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, NOW())
     WHERE order_number = $1 AND status = 'pending_payment'
     RETURNING id`,
    [orderNumber],
  );
  if (current.rows[0]) {
    await query(
      `INSERT INTO order_history (order_id, status_from, status_to, notes)
       VALUES ($1, 'pending_payment', 'paid', $2)`,
      [current.rows[0].id, notes],
    );
    await onOrderPaid(current.rows[0].id);
  }
  return current.rows[0] || null;
}

/**
 * Payment router
 */
export async function handlePayments(req, method, urlPath, headers, body, ipAddress, userAgent) {
  const url = new URL(`http://localhost${urlPath}`);
  const pathParts = url.pathname.replace('/api/v1/payments', '').split('/').filter(Boolean);

  try {
    // Initiate payment
    if (method === 'POST' && pathParts[0] === 'initiate') {
      const token = headers.authorization?.replace('Bearer ', '');
      const auth = token ? await validateToken(token) : null;
      if (!auth) {
        return { status: 401, body: { error: 'Unauthorized' } };
      }
      return await initiatePayment(body, auth.userId, ipAddress, userAgent, headers);
    }

    // Payment callback (success/failure)
    if (method === 'GET' && pathParts[0] === 'callback') {
      const gateway = pathParts[1]; // esewa or khalti
      return await handleCallback(gateway, url.searchParams);
    }

    // Webhook handler (for async notifications)
    if (method === 'POST' && pathParts[0] === 'webhook') {
      const gateway = pathParts[1]; // esewa or khalti
      return await handleWebhook(gateway, body, headers);
    }

    // Get payment status
    if (method === 'GET' && pathParts[0] === 'status' && pathParts[1]) {
      return await getPaymentStatus(pathParts[1]);
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    console.error('Payment API error:', error);
    return { status: 500, body: { error: 'Internal server error', details: error.message } };
  }
}

/**
 * Validate auth token
 */
async function validateToken(token) {
  const hash = createHash('sha256').update(token).digest('hex');
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
 * Initiate payment with selected gateway
 */
async function initiatePayment(data, userId, ipAddress, userAgent, headers = {}) {
  const { order_id, gateway } = data; // gateway: 'esewa' or 'khalti'

  if (!order_id || !gateway) {
    return { status: 400, body: { error: 'order_id and gateway are required' } };
  }

  // Get order details
  const orderResult = await query(
    `SELECT * FROM orders WHERE id = $1 AND buyer_id = $2 AND status = 'pending_payment'`,
    [order_id, userId]
  );

  if (!orderResult.rows[0]) {
    return { status: 404, body: { error: 'Order not found or already paid' } };
  }

  const order = orderResult.rows[0];

  // Create payment record
  const paymentResult = await query(
    `INSERT INTO payments (order_id, gateway, amount, status, ip_address, user_agent)
     VALUES ($1, $2, $3, 'pending', $4, $5)
     RETURNING id`,
    [order_id, gateway, order.total_amount, ipAddress, userAgent]
  );

  const paymentId = paymentResult.rows[0].id;

  // Generate payment URL based on gateway
  let paymentUrl;
  if (gateway === 'esewa') {
    paymentUrl = await generateEsewaPaymentUrl(order, paymentId, headers);
  } else if (gateway === 'khalti') {
    paymentUrl = await generateKhaltiPaymentUrl(order, paymentId, headers);
  } else {
    return { status: 400, body: { error: 'Invalid gateway. Use "esewa" or "khalti"' } };
  }

  return {
    status: 200,
    body: {
      payment_id: paymentId,
      payment_url: paymentUrl,
      gateway,
      amount: order.total_amount
    }
  };
}

/**
 * Generate eSewa payment URL
 */
async function generateEsewaPaymentUrl(order, paymentId, headers = {}) {
  const frontend = publicFrontend(headers);
  const apiPublic = publicApi(headers);
  const ESEWA_MERCHANT_CODE = process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST';
  const ESEWA_SUCCESS_URL = process.env.ESEWA_SUCCESS_URL || `${apiPublic}/api/v1/payments/callback/esewa`;
  const ESEWA_FAILURE_URL = process.env.ESEWA_FAILURE_URL || `${frontend}/payment/failed`;

  // eSewa payment parameters
  const params = new URLSearchParams({
    amt: order.total_amount.toString(),
    psc: '0', // Service charge
    pdc: '0', // Delivery charge
    txAmt: order.tax_amount.toString(),
    tAmt: order.total_amount.toString(),
    pid: `${order.order_number}-${paymentId}`, // Unique product ID
    scd: ESEWA_MERCHANT_CODE,
    su: `${ESEWA_SUCCESS_URL}?q=su`,
    fu: `${ESEWA_FAILURE_URL}?q=fu`
  });

  // eSewa sandbox URL
  const ESEWA_URL = process.env.ESEWA_URL || 'https://uat.esewa.com.np/epay/main';
  
  return `${ESEWA_URL}?${params.toString()}`;
}

/**
 * Generate Khalti payment URL
 */
async function generateKhaltiPaymentUrl(order, paymentId, headers = {}) {
  const frontend = publicFrontend(headers);
  const apiPublic = publicApi(headers);
  const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || 'test_secret_key_f59e8b7d18b4499ca40f68195a846e9b';
  const KHALTI_RETURN_URL = process.env.KHALTI_RETURN_URL || `${apiPublic}/api/v1/payments/callback/khalti`;
  const KHALTI_WEBHOOK_URL = process.env.KHALTI_WEBHOOK_URL || `${apiPublic}/api/v1/payments/webhook/khalti`;

  // Khalti payment initiation API
  const KHALTI_API_URL = process.env.KHALTI_API_URL || 'https://khalti.com/api/v2/epayment/initiate/';

  const payload = {
    return_url: KHALTI_RETURN_URL,
    website_url: frontend,
    amount: Math.round(order.total_amount * 100), // Khalti uses paisa (1 NPR = 100 paisa)
    purchase_order_id: `${order.order_number}-${paymentId}`,
    purchase_order_name: `Order ${order.order_number}`,
    customer_info: {
      name: order.shipping_name,
      email: '',
      phone: order.shipping_phone
    }
  };

  try {
    const response = await fetch(KHALTI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('Khalti initiation failed:', await response.text());
      throw new Error('Failed to initiate Khalti payment');
    }

    const data = await response.json();
    
    // Store Khalti payment URL in payment record
    await query(
      `UPDATE payments SET gateway_response = $1 WHERE id = $2`,
      [JSON.stringify(data), paymentId]
    );

    return data.payment_url;
  } catch (error) {
    console.error('Khalti error:', error);
    // Fallback to sandbox URL
    return `https://test-pay.khalti.com/?pidx=${order.order_number}-${paymentId}`;
  }
}

/**
 * Handle payment callback (redirect from gateway)
 */
async function handleCallback(gateway, params) {
  if (gateway === 'esewa') {
    return await handleEsewaCallback(params);
  } else if (gateway === 'khalti') {
    return await handleKhaltiCallback(params);
  }
  
  return { status: 400, body: { error: 'Invalid gateway' } };
}

/**
 * Handle eSewa callback
 */
async function handleEsewaCallback(params) {
  const frontend = publicFrontend();
  const oid = params.get('oid') || params.get('pid');
  const refId = params.get('refId') || params.get('ref_id');
  const amt = params.get('amt') || params.get('amount');
  const found = parseGatewayPid(oid);

  if (!oid || !refId) {
    return {
      status: 302,
      headers: { Location: `${frontend}/payment/failed` },
      body: {},
    };
  }

  const verified = await verifyEsewaPayment(amt, refId, oid);

  if (verified) {
    if (found.paymentId) {
      await query(
        `UPDATE payments
         SET status = 'completed', gateway_transaction_id = $1,
             completed_at = NOW(), gateway_response = $2
         WHERE id = $3`,
        [refId, JSON.stringify({ amt, refId, oid }), found.paymentId],
      );
    }
    await markOrderPaid(found.orderNumber, 'Payment successful via eSewa');
    return {
      status: 302,
      headers: { Location: `${frontend}/orders/${found.orderNumber}?success=true` },
      body: {},
    };
  }

  if (found.paymentId) {
    await query(
      `UPDATE payments
       SET status = 'failed', failed_at = NOW(),
           failure_reason = 'Payment verification failed'
       WHERE id = $1`,
      [found.paymentId],
    );
  }

  return {
    status: 302,
    headers: { Location: `${frontend}/payment/failed` },
    body: {},
  };
}

/**
 * Verify eSewa payment
 */
async function verifyEsewaPayment(amt, refId, oid) {
  const ESEWA_MERCHANT_CODE = process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST';
  const ESEWA_VERIFY_URL = process.env.ESEWA_VERIFY_URL || 'https://uat.esewa.com.np/epay/transrec';

  try {
    const params = new URLSearchParams({
      amt: amt,
      rid: refId,
      pid: oid,
      scd: ESEWA_MERCHANT_CODE
    });

    const response = await fetch(`${ESEWA_VERIFY_URL}?${params.toString()}`);
    const text = await response.text();

    // eSewa returns XML with success/failure
    return text.includes('<response_code>Success</response_code>');
  } catch (error) {
    console.error('eSewa verification error:', error);
    return false;
  }
}

/**
 * Handle Khalti callback
 */
async function handleKhaltiCallback(params) {
  const frontend = publicFrontend();
  const pidx = params.get('pidx');
  const txnId = params.get('transaction_id');
  const amount = params.get('amount');
  const status = params.get('status');
  const pid = params.get('purchase_order_id') || pidx;
  const found = parseGatewayPid(pid);

  if (!pidx && !pid) {
    return {
      status: 302,
      headers: { Location: `${frontend}/payment/failed` },
      body: {},
    };
  }

  if (status === 'Completed') {
    const verified = pidx ? await verifyKhaltiPayment(pidx, txnId) : true;
    if (verified) {
      if (found.paymentId) {
        await query(
          `UPDATE payments
           SET status = 'completed', gateway_transaction_id = $1,
               completed_at = NOW(), gateway_response = $2
           WHERE id = $3`,
          [txnId, JSON.stringify({ pidx, txnId, amount, status, pid }), found.paymentId],
        );
      }
      await markOrderPaid(found.orderNumber, 'Payment successful via Khalti');
      return {
        status: 302,
        headers: { Location: `${frontend}/orders/${found.orderNumber}?success=true` },
        body: {},
      };
    }
  }

  if (found.paymentId) {
    await query(
      `UPDATE payments
       SET status = 'failed', failed_at = NOW(),
           failure_reason = 'Payment failed or cancelled'
       WHERE id = $1`,
      [found.paymentId],
    );
  }

  return {
    status: 302,
    headers: { Location: `${frontend}/payment/failed` },
    body: {},
  };
}

/**
 * Verify Khalti payment
 */
async function verifyKhaltiPayment(pidx, txnId) {
  const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || 'test_secret_key_f59e8b7d18b4499ca40f68195a846e9b';
  const KHALTI_VERIFY_URL = process.env.KHALTI_VERIFY_URL || 'https://khalti.com/api/v2/epayment/lookup/';

  try {
    const response = await fetch(KHALTI_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pidx })
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.status === 'Completed';
  } catch (error) {
    console.error('Khalti verification error:', error);
    return false;
  }
}

/**
 * Handle webhook (async notification from gateway)
 */
function webhookSignatureValid(gateway, payload, headers) {
  const secret = process.env[`${gateway.toUpperCase()}_WEBHOOK_SECRET`] || process.env.KHALTI_SECRET_KEY;
  if (!secret) return { ok: false, reason: 'secret_missing' };
  const auth = String(headers.authorization || headers.Authorization || '');
  if (auth.includes(secret) || auth === `Key ${secret}`) return { ok: true };
  const sig = headers['x-khalti-signature'] || headers['x-webhook-signature'] || headers.signature;
  if (!sig) return { ok: false, reason: 'signature_missing' };
  const expected = createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  if (String(sig) === expected) return { ok: true };
  return { ok: false, reason: 'mismatch' };
}

async function handleWebhook(gateway, payload, headers) {
  const verified = webhookSignatureValid(gateway, payload || {}, headers || {});
  if (!verified.ok && process.env.NODE_ENV === 'production') {
    return { status: 401, body: { error: 'Invalid webhook signature' } };
  }
  // Store webhook for idempotency
  const eventId = payload.event_id || payload.txnId || payload.transaction_id;
  
  if (eventId) {
    const existing = await query(
      'SELECT id FROM payment_webhooks WHERE gateway = $1 AND event_id = $2',
      [gateway, eventId]
    );

    if (existing.rows[0]) {
      // Already processed
      return { status: 200, body: { message: 'Webhook already processed' } };
    }
  }

  // Store webhook
  await query(
    `INSERT INTO payment_webhooks (gateway, event_type, event_id, payload, signature, received_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [gateway, payload.event_type || 'payment', eventId, JSON.stringify(payload), headers.signature || null]
  );

  // Process webhook based on gateway
  if (gateway === 'esewa') {
    // eSewa doesn't typically send webhooks, uses callbacks
    return { status: 200, body: { message: 'Webhook received' } };
  } else if (gateway === 'khalti') {
    // Process Khalti webhook
    return await processKhaltiWebhook(payload);
  }

  return { status: 200, body: { message: 'Webhook received' } };
}

/**
 * Process Khalti webhook
 */
async function processKhaltiWebhook(payload) {
  // Khalti sends webhooks for payment status updates
  const { pidx, transaction_id, status, amount } = payload;

  if (!pidx) {
    return { status: 400, body: { error: 'Invalid webhook payload' } };
  }

  const [orderNumber, paymentId] = pidx.split('-');

  if (status === 'Completed') {
    // Update if not already updated
    await query(
      `UPDATE payments 
       SET status = 'completed', gateway_transaction_id = $1, completed_at = NOW()
       WHERE id = $2 AND status != 'completed'`,
      [transaction_id, paymentId]
    );

    await markOrderPaid(orderNumber, 'Payment successful via Khalti webhook');
  }

  // Mark webhook as processed
  await query(
    `UPDATE payment_webhooks SET processed = true, processed_at = NOW()
     WHERE gateway = 'khalti' AND event_id = $1`,
    [transaction_id]
  );

  return { status: 200, body: { message: 'Webhook processed' } };
}

/**
 * Get payment status
 */
async function getPaymentStatus(paymentId) {
  const result = await query(
    `SELECT p.*, o.order_number, o.status as order_status
     FROM payments p
     JOIN orders o ON p.order_id = o.id
     WHERE p.id = $1`,
    [paymentId]
  );

  if (!result.rows[0]) {
    return { status: 404, body: { error: 'Payment not found' } };
  }

  return { status: 200, body: { payment: result.rows[0] } };
}

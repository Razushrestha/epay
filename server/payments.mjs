/**
 * Payment Gateway Integration
 * eSewa and Khalti payment processing for Nepal
 */

import { query } from './db.mjs';
import { createHash, createHmac } from 'node:crypto';
import { onOrderPaid } from './ledger.mjs';
import { parseGatewayPid, publicApi, publicFrontend } from './public-urls.mjs';
import { ensureCheckoutSessionTables } from './cart.mjs';

async function markOrderPaid(orderNumber, notes) {
  const found = await query(
    `SELECT id, buyer_id, checkout_session_id FROM orders WHERE order_number = $1`,
    [orderNumber],
  );
  if (!found.rows[0]) return null;
  const sessionId = found.rows[0].checkout_session_id;
  const current = sessionId
    ? await query(
        `UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, NOW())
         WHERE checkout_session_id = $1 AND status = 'pending_payment'
         RETURNING id, buyer_id`,
        [sessionId],
      )
    : await query(
        `UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, NOW())
         WHERE order_number = $1 AND status = 'pending_payment'
         RETURNING id, buyer_id`,
        [orderNumber],
      );
  if (sessionId) {
    await query(
      `UPDATE checkout_sessions SET status = 'paid', paid_at = COALESCE(paid_at, NOW())
       WHERE id = $1`,
      [sessionId],
    );
  }
  for (const row of current.rows) {
    await query(
      `INSERT INTO order_history (order_id, status_from, status_to, notes)
       VALUES ($1, 'pending_payment', 'paid', $2)`,
      [row.id, notes],
    );
    await onOrderPaid(row.id);
  }
  const buyerId = current.rows[0]?.buyer_id || found.rows[0].buyer_id;
  if (buyerId) {
    await query(`DELETE FROM cart_items WHERE user_id = $1`, [buyerId]);
  }
  return current.rows[0] || found.rows[0];
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
      await ensureCheckoutSessionTables();
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

    if (method === 'GET' && pathParts[0] === 'esewa' && pathParts[1] === 'redirect' && pathParts[2]) {
      return await esewaRedirectPage(pathParts[2], headers);
    }

    // Get payment status
    if (method === 'GET' && pathParts[0] === 'status' && pathParts[1]) {
      return await getPaymentStatus(pathParts[1]);
    }

    if (method === 'POST' && pathParts[0] === 'khalti' && pathParts[1] === 'lookup') {
      if (!body?.pidx) {
        return { status: 400, body: { error: 'pidx is required' } };
      }
      return { status: 200, body: await confirmKhaltiLookup(body.pidx, body.purchase_order_id) };
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
  let payAmount = order.total_amount;
  const sessionId = order.checkout_session_id || data.checkout_session_id || null;
  if (sessionId) {
    const session = await query(`SELECT total_amount FROM checkout_sessions WHERE id = $1`, [sessionId]);
    if (session.rows[0]) payAmount = session.rows[0].total_amount;
  }
  const gatewayOrder = { ...order, total_amount: payAmount };

  // Create payment record
  const paymentResult = await query(
    `INSERT INTO payments (order_id, checkout_session_id, gateway, amount, status, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6)
     RETURNING id`,
    [order_id, sessionId, gateway, payAmount, ipAddress, userAgent]
  );

  const paymentId = paymentResult.rows[0].id;

  // Generate payment URL based on gateway
  let paymentUrl;
  if (gateway === 'esewa') {
    paymentUrl = await generateEsewaPaymentUrl(gatewayOrder, paymentId, headers);
  } else if (gateway === 'khalti') {
    paymentUrl = await generateKhaltiPaymentUrl(gatewayOrder, paymentId, headers);
  } else {
    return { status: 400, body: { error: 'Invalid gateway. Use "esewa" or "khalti"' } };
  }

  return {
    status: 200,
    body: {
      payment_id: paymentId,
      payment_url: paymentUrl,
      gateway,
      amount: payAmount,
      checkout_session_id: sessionId,
    }
  };
}

function esewaMerchantCode() {
  return process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST';
}

function esewaSecret() {
  return process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q';
}

function esewaFormAction() {
  return process.env.ESEWA_URL || 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
}

function esewaSignature(totalAmount, uuid, productCode) {
  const message = `total_amount=${totalAmount},transaction_uuid=${uuid},product_code=${productCode}`;
  return createHmac('sha256', esewaSecret()).update(message).digest('base64');
}

/**
 * Generate eSewa payment URL
 */
async function generateEsewaPaymentUrl(order, paymentId, headers = {}) {
  const apiPublic = publicApi(headers);
  const scd = esewaMerchantCode();
  const total = Number(order.total_amount) || 0;
  const tax = Number(order.tax_amount) || 0;
  const amt = Number((total - tax).toFixed(2));
  const pid = `${order.order_number}-${paymentId}`;
  const params = new URLSearchParams({
    amt: amt.toFixed(2),
    pid,
    scd,
  });
  return `${apiPublic}/api/v1/payments/esewa/redirect/${paymentId}?${params.toString()}`;
}

async function esewaRedirectPage(paymentId, headers = {}) {
  const payment = await query(
    `SELECT p.*, o.order_number, o.total_amount, o.tax_amount
     FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE p.id = $1 AND p.gateway = 'esewa' AND p.status = 'pending'`,
    [paymentId],
  );
  if (!payment.rows[0]) {
    return { status: 404, body: { error: 'Payment not found' } };
  }

  const row = payment.rows[0];
  const frontend = publicFrontend(headers);
  const apiPublic = publicApi(headers);
  const scd = esewaMerchantCode();
  const total = Number(row.total_amount) || 0;
  const tax = Number(row.tax_amount) || 0;
  const amt = Number((total - tax).toFixed(2)).toFixed(2);
  const taxAmt = tax.toFixed(2);
  const tAmt = total.toFixed(2);
  const pid = `${row.order_number}-${row.id}`;
  const successUrl = process.env.ESEWA_SUCCESS_URL || `${apiPublic}/api/v1/payments/callback/esewa`;
  const failureUrl = process.env.ESEWA_FAILURE_URL || `${apiPublic}/api/v1/payments/callback/esewa?q=fu`;
  const signature = esewaSignature(tAmt, pid, scd);
  const action = esewaFormAction();

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Redirecting to eSewa</title></head>
<body>
  <p>Redirecting to eSewa UAT… amt=${amt} pid=${pid} scd=${scd}</p>
  <form id="esewa-pay" action="${action}" method="POST">
    <input type="hidden" name="amount" value="${amt}">
    <input type="hidden" name="tax_amount" value="${taxAmt}">
    <input type="hidden" name="total_amount" value="${tAmt}">
    <input type="hidden" name="transaction_uuid" value="${pid}">
    <input type="hidden" name="product_code" value="${scd}">
    <input type="hidden" name="product_service_charge" value="0">
    <input type="hidden" name="product_delivery_charge" value="0">
    <input type="hidden" name="success_url" value="${successUrl}">
    <input type="hidden" name="failure_url" value="${failureUrl}">
    <input type="hidden" name="signed_field_names" value="total_amount,transaction_uuid,product_code">
    <input type="hidden" name="signature" value="${signature}">
    <input type="hidden" name="amt" value="${amt}">
    <input type="hidden" name="pid" value="${pid}">
    <input type="hidden" name="scd" value="${scd}">
  </form>
  <script>document.getElementById('esewa-pay').submit();</script>
</body>
</html>`;

  return {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  };
}

/**
 * Generate Khalti payment URL
 */
const KHALTI_INITIATE_URL = 'https://khalti.com/api/v2/epayment/initiate/';
const KHALTI_SANDBOX_INITIATE_URL = 'https://dev.khalti.com/api/v2/epayment/initiate/';
const KHALTI_LOOKUP_URL = 'https://khalti.com/api/v2/epayment/lookup/';
const KHALTI_SANDBOX_LOOKUP_URL = 'https://dev.khalti.com/api/v2/epayment/lookup/';

function khaltiSecretKey() {
  return process.env.KHALTI_SECRET_KEY || 'live_secret_key_68791341fdd94846a146f0457ff7b455';
}

async function postKhalti(url, body, fallbackUrl) {
  const headers = {
    Authorization: `Key ${khaltiSecretKey()}`,
    'Content-Type': 'application/json',
  };
  const payload = JSON.stringify(body);
  console.log('[khalti] POST', url);
  let response = await fetch(url, { method: 'POST', headers, body: payload });
  let raw = await response.text();
  if (!response.ok && fallbackUrl && (response.status === 401 || response.status === 403)) {
    console.log('[khalti] POST fallback', fallbackUrl);
    response = await fetch(fallbackUrl, { method: 'POST', headers, body: payload });
    raw = await response.text();
    return { response, raw, url: fallbackUrl, attempted: [url, fallbackUrl] };
  }
  return { response, raw, url, attempted: [url] };
}

export async function generateKhaltiPaymentUrl(order, paymentId, headers = {}) {
  const frontend = publicFrontend(headers);
  const apiPublic = publicApi(headers);
  const KHALTI_RETURN_URL = process.env.KHALTI_RETURN_URL || `${apiPublic}/api/v1/payments/callback/khalti`;
  const KHALTI_API_URL = process.env.KHALTI_API_URL || KHALTI_INITIATE_URL;
  const sandboxFallback = KHALTI_API_URL.includes('khalti.com/api/v2') && !KHALTI_API_URL.includes('dev.khalti.com')
    ? KHALTI_SANDBOX_INITIATE_URL
    : '';

  const payload = {
    return_url: KHALTI_RETURN_URL,
    website_url: frontend,
    amount: Math.round(Number(order.total_amount) * 100),
    purchase_order_id: `${order.order_number}-${paymentId}`,
    purchase_order_name: `Order ${order.order_number}`,
    customer_info: {
      name: order.shipping_name || 'Nexlo Buyer',
      email: 'buyer@example.com',
      phone: order.shipping_phone || '9800000000'
    }
  };

  const { response, raw, url, attempted } = await postKhalti(KHALTI_API_URL, payload, sandboxFallback);
  if (!response.ok) {
    console.error('Khalti initiation failed:', raw);
    throw new Error(raw || 'Failed to initiate Khalti payment');
  }

  const data = JSON.parse(raw);
  await query(
    `UPDATE payments SET gateway_response = $1 WHERE id = $2`,
    [JSON.stringify({ initiate_url: KHALTI_INITIATE_URL, used_url: url, attempted, ...data }), paymentId]
  );

  if (!data.payment_url) {
    throw new Error('Khalti initiate did not return payment_url');
  }
  return data.payment_url;
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
async function redirectPaymentCancelled(frontend, paymentId) {
  if (paymentId) {
    await query(
      `UPDATE payments
       SET status = 'failed', failed_at = NOW(),
           failure_reason = 'Payment cancelled'
       WHERE id = $1 AND status = 'pending'`,
      [paymentId],
    );
  }
  return {
    status: 302,
    headers: { Location: `${frontend}/checkout?cancelled=1` },
    body: {},
  };
}

export async function handleEsewaCallback(params) {
  const frontend = publicFrontend();
  let oid = params.get('oid') || params.get('pid');
  let refId = params.get('refId') || params.get('ref_id') || params.get('rid') || params.get('transaction_code');
  let amt = params.get('amt') || params.get('amount') || params.get('total_amount');
  const scd = params.get('scd') || esewaMerchantCode();
  const encoded = params.get('data');
  if (encoded && (!oid || !refId)) {
    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
      oid = oid || parsed.transaction_uuid || parsed.pid || parsed.oid;
      refId = refId || parsed.transaction_code || parsed.refId;
      amt = amt || parsed.total_amount || parsed.amt;
    } catch {
      // keep query-string fields
    }
  }
  const found = parseGatewayPid(oid);
  const cancelled =
    params.get('q') === 'fu' ||
    /cancel|fail|pending/i.test(String(params.get('status') || ''));

  if (cancelled || !refId) {
    return redirectPaymentCancelled(frontend, found.paymentId);
  }

  const verified = await verifyEsewaPayment(amt, refId, oid, scd);

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
    const refQuery = refId ? `&ref=${encodeURIComponent(refId)}` : '';
    return {
      status: 302,
      headers: { Location: `${frontend}/order/${found.orderNumber}?success=true${refQuery}` },
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
 * Verify eSewa payment via transrec (amt, rid, pid, scd).
 */
export async function verifyEsewaPayment(amt, refId, oid, scd = esewaMerchantCode()) {
  const ESEWA_VERIFY_URL = process.env.ESEWA_VERIFY_URL || 'https://uat.esewa.com.np/epay/transrec';
  const params = new URLSearchParams({
    amt: String(amt ?? ''),
    rid: String(refId ?? ''),
    pid: String(oid ?? ''),
    scd: String(scd || esewaMerchantCode()),
  });

  let text = '';
  try {
    const response = await fetch(`${ESEWA_VERIFY_URL}?${params.toString()}`);
    text = await response.text();
  } catch (error) {
    console.error('eSewa transrec GET error:', error);
  }

  if (!text.includes('<response_code>Success</response_code>')) {
    try {
      const response = await fetch(ESEWA_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      text = await response.text();
    } catch (error) {
      console.error('eSewa transrec POST error:', error);
    }
  }

  return text.includes('<response_code>Success</response_code>');
}

/**
 * Handle Khalti callback
 */
export async function handleKhaltiCallback(params) {
  const frontend = publicFrontend();
  const pidx = params.get('pidx');
  const status = params.get('status');
  const pid = params.get('purchase_order_id');

  if (!pidx && !pid) {
    return {
      status: 302,
      headers: { Location: `${frontend}/payment/failed` },
      body: {},
    };
  }

  if (pidx) {
    const confirmed = await confirmKhaltiLookup(pidx, pid);
    if (confirmed.verified) {
      const refQuery = confirmed.transaction_id ? `&ref=${encodeURIComponent(confirmed.transaction_id)}` : '';
      return {
        status: 302,
        headers: { Location: `${frontend}/order/${confirmed.order_number}?success=true${refQuery}` },
        body: {},
      };
    }
    if (confirmed.order_number && !/cancel/i.test(String(status || '')) && !/expired|failed/i.test(String(confirmed.status || ''))) {
      return {
        status: 302,
        headers: { Location: `${frontend}/order/${confirmed.order_number}` },
        body: {},
      };
    }
  }

  const found = parseGatewayPid(pid || pidx);
  if (found.paymentId) {
    await query(
      `UPDATE payments
       SET status = 'failed', failed_at = NOW(),
           failure_reason = 'Payment failed or cancelled'
       WHERE id = $1 AND status != 'completed'`,
      [found.paymentId],
    );
  }

  return {
    status: 302,
    headers: { Location: `${frontend}/payment/failed` },
    body: {},
  };
}

export async function verifyKhaltiPayment(pidx) {
  const KHALTI_VERIFY_URL = process.env.KHALTI_VERIFY_URL || KHALTI_LOOKUP_URL;
  const sandboxFallback = KHALTI_VERIFY_URL.includes('khalti.com/api/v2') && !KHALTI_VERIFY_URL.includes('dev.khalti.com')
    ? KHALTI_SANDBOX_LOOKUP_URL
    : '';

  const { response, raw, url } = await postKhalti(KHALTI_VERIFY_URL, { pidx }, sandboxFallback);
  if (!response.ok) {
    console.error('Khalti lookup failed:', raw);
    return { ok: false, status: null, transaction_id: null, lookup: raw, url };
  }
  const lookup = JSON.parse(raw);
  return {
    ok: /^completed$/i.test(String(lookup.status || '')),
    status: lookup.status || null,
    transaction_id: lookup.transaction_id || null,
    lookup,
    url,
  };
}

async function findKhaltiPayment(pidx, purchaseOrderId) {
  const fromPid = parseGatewayPid(purchaseOrderId);
  if (fromPid.paymentId) return fromPid;
  const byPidx = await query(
    `SELECT p.id, o.order_number
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE p.gateway = 'khalti' AND p.gateway_response->>'pidx' = $1
     ORDER BY p.id DESC LIMIT 1`,
    [pidx],
  );
  if (byPidx.rows[0]) {
    return { paymentId: byPidx.rows[0].id, orderNumber: byPidx.rows[0].order_number };
  }
  return { paymentId: null, orderNumber: fromPid.orderNumber || null };
}

export async function confirmKhaltiLookup(pidx, purchaseOrderId) {
  const verified = await verifyKhaltiPayment(pidx);
  const found = await findKhaltiPayment(pidx, purchaseOrderId);
  const payload = {
    pidx,
    lookup_url: 'https://khalti.com/api/v2/epayment/lookup/',
    used_url: verified.url,
    lookup: verified.lookup,
    status: verified.status,
    transaction_id: verified.transaction_id,
  };

  if (found.paymentId) {
    if (verified.ok) {
      await query(
        `UPDATE payments
         SET status = 'completed',
             gateway_transaction_id = COALESCE($1, gateway_transaction_id),
             completed_at = COALESCE(completed_at, NOW()),
             gateway_response = $2
         WHERE id = $3`,
        [verified.transaction_id, JSON.stringify(payload), found.paymentId],
      );
      if (found.orderNumber) {
        await markOrderPaid(found.orderNumber, 'Payment successful via Khalti lookup');
      }
    } else {
      await query(
        `UPDATE payments SET gateway_response = $1 WHERE id = $2 AND status != 'completed'`,
        [JSON.stringify(payload), found.paymentId],
      );
    }
  }

  return {
    verified: Boolean(verified.ok && found.paymentId),
    status: verified.status,
    transaction_id: verified.transaction_id,
    payment_id: found.paymentId,
    order_number: found.orderNumber,
    lookup: verified.lookup,
  };
}

/**
 * Handle webhook (async notification from gateway)
 */
function webhookSecret(gateway) {
  return process.env[`${String(gateway || '').toUpperCase()}_WEBHOOK_SECRET`] || khaltiSecretKey();
}

export function webhookSignatureValid(gateway, payload, headers = {}) {
  const secret = webhookSecret(gateway);
  if (!secret) return { ok: false, reason: 'secret_missing' };
  const sig = headers['x-khalti-signature'] || headers['x-webhook-signature'] || headers.signature;
  if (!sig) return { ok: false, reason: 'signature_missing' };
  const expected = createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  if (String(sig) === expected) return { ok: true };
  return { ok: false, reason: 'mismatch' };
}

export async function handleWebhook(gateway, payload, headers) {
  const body = payload || {};
  const verified = webhookSignatureValid(gateway, body, headers || {});
  if (!verified.ok) {
    return { status: 401, body: { error: 'Invalid webhook signature' } };
  }

  const eventId = body.event_id || body.txnId || body.transaction_id || body.tidx;
  if (!eventId) {
    return { status: 400, body: { error: 'transaction_id is required' } };
  }

  const signature = headers['x-khalti-signature'] || headers['x-webhook-signature'] || headers.signature || null;
  const inserted = await query(
    `INSERT INTO payment_webhooks (gateway, event_type, event_id, payload, signature, received_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (gateway, event_id) DO NOTHING
     RETURNING id`,
    [gateway, body.event_type || 'payment', String(eventId), JSON.stringify(body), signature],
  );

  if (!inserted.rows[0]) {
    return { status: 200, body: { message: 'Webhook already processed', replayed: true } };
  }

  if (gateway === 'khalti') {
    return await processKhaltiWebhook(body);
  }

  await query(
    `UPDATE payment_webhooks SET processed = true, processed_at = NOW() WHERE id = $1`,
    [inserted.rows[0].id],
  );
  return { status: 200, body: { message: 'Webhook received', replayed: false } };
}

async function processKhaltiWebhook(payload) {
  const status = payload.status;
  const transactionId = payload.transaction_id || payload.txnId || payload.tidx;
  const pid = payload.purchase_order_id || payload.pid;
  let found = parseGatewayPid(pid);
  if (!found.paymentId && payload.pidx) {
    const byPidx = await query(
      `SELECT p.id, o.order_number
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE p.gateway = 'khalti' AND p.gateway_response->>'pidx' = $1
       ORDER BY p.id DESC LIMIT 1`,
      [payload.pidx],
    );
    if (byPidx.rows[0]) {
      found = { paymentId: byPidx.rows[0].id, orderNumber: byPidx.rows[0].order_number };
    }
  }

  if (/^completed$/i.test(String(status || '')) && found.paymentId) {
    await query(
      `UPDATE payments
       SET status = 'completed', gateway_transaction_id = $1, completed_at = COALESCE(completed_at, NOW())
       WHERE id = $2 AND status != 'completed'`,
      [transactionId, found.paymentId],
    );
    if (found.orderNumber) {
      await markOrderPaid(found.orderNumber, 'Payment successful via Khalti webhook');
    }
  }

  await query(
    `UPDATE payment_webhooks SET processed = true, processed_at = NOW()
     WHERE gateway = 'khalti' AND event_id = $1`,
    [String(transactionId)],
  );

  return { status: 200, body: { message: 'Webhook processed', replayed: false, payment_id: found.paymentId || null } };
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

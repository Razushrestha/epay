import { query } from "./db.mjs";
import { notify } from "./notify.mjs";
import { releaseEscrow } from "./ledger.mjs";
import { buildInvoicePdf } from "./pdf.mjs";

function httpError(result) {
  return Boolean(result && Number.isInteger(result.status) && Object.hasOwn(result, "body"));
}

async function hasOpenCase(orderId) {
  const { rows } = await query(
    `SELECT 1 FROM cases WHERE order_id = $1 AND status NOT IN ('resolved','closed') LIMIT 1`,
    [orderId],
  ).catch(() => ({ rows: [] }));
  return Boolean(rows[0]);
}

async function completeAndRelease(order, actorId, note) {
  if (await hasOpenCase(order.id)) return { skipped: true, reason: "open_case" };
  const hold = await query(`SELECT status FROM escrow_holds WHERE order_id = $1`, [order.id]);
  if (hold.rows[0]?.status === "frozen") return { skipped: true, reason: "frozen" };
  await query(
    `UPDATE orders SET status = 'completed', completed_at = NOW(), delivered_at = COALESCE(delivered_at, NOW())
     WHERE id = $1 AND status IN ('delivered', 'shipped')`,
    [order.id],
  );
  const released = await releaseEscrow(order.id);
  await query(
    `INSERT INTO order_history (order_id, status_from, status_to, changed_by, notes)
     VALUES ($1,'delivered','completed',$2,$3)`,
    [order.id, actorId || null, note || "Order completed; escrow released"],
  );
  return { completed: true, escrow: released };
}

export async function autoCompleteOrders() {
  const received = await query(
    `UPDATE orders SET status = 'delivered', delivered_at = COALESCE(delivered_at, NOW())
     WHERE status = 'shipped' AND shipped_at IS NOT NULL AND shipped_at < NOW() - INTERVAL '7 days'
       AND NOT EXISTS (SELECT 1 FROM cases c WHERE c.order_id = orders.id AND c.status NOT IN ('resolved','closed'))
     RETURNING id, buyer_id`,
  );
  for (const row of received.rows) {
    await notify(row.buyer_id, "delivered", "Marked delivered", "This order was auto-marked as received after 7 days.", "/orders");
    await query(`INSERT INTO order_history (order_id, status_from, status_to, notes) VALUES ($1,'shipped','delivered','Auto-received after 7 days')`, [row.id]);
  }
  const done = await query(
    `UPDATE orders SET status = 'completed', completed_at = NOW()
     WHERE status = 'delivered' AND delivered_at IS NOT NULL AND delivered_at < NOW() - INTERVAL '14 days'
       AND NOT EXISTS (SELECT 1 FROM cases c WHERE c.order_id = orders.id AND c.status NOT IN ('resolved','closed'))
       AND NOT EXISTS (SELECT 1 FROM escrow_holds e WHERE e.order_id = orders.id AND e.status = 'frozen')
     RETURNING id, buyer_id`,
  );
  for (const row of done.rows) {
    await releaseEscrow(row.id);
    await notify(row.buyer_id, "completed", "Order completed", "Leave feedback for this order.", "/account?tab=feedback");
  }
}

export async function handleFulfillment(method, pathParts, auth, body) {
  if (pathParts[0] !== "orders") return null;
  if (!auth) return { status: 401, body: { error: "Sign in required" } };

  if (method === "GET" && !pathParts[1]) {
    const { rows } = await query(
      `SELECT o.*, json_agg(json_build_object(
          'id', oi.id, 'title', oi.title, 'quantity', oi.quantity, 'price', oi.price,
          'status', oi.status, 'tracking_number', oi.tracking_number, 'carrier', oi.carrier,
          'seller_id', oi.seller_id, 'listing_id', oi.listing_id
        )) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.buyer_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC LIMIT 50`,
      [auth.user_id],
    );
    return { status: 200, body: { data: rows } };
  }

  if (method === "GET" && pathParts[1] === "selling") {
    const { rows } = await query(
      `SELECT DISTINCT o.*, oi.title AS product, oi.tracking_number, oi.carrier, oi.status AS item_status, oi.id AS item_id
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       WHERE oi.seller_id = $1 ORDER BY o.created_at DESC LIMIT 50`,
      [auth.user_id],
    );
    return { status: 200, body: { data: rows } };
  }

  if (method === "GET" && pathParts[1] === "policy") {
    const { rows } = await query(`SELECT * FROM shipping_policies WHERE seller_id = $1`, [auth.user_id]);
    return { status: 200, body: { data: rows[0] || { handling_days: 3, default_cost: 0 } } };
  }

  if (method === "PUT" && pathParts[1] === "policy") {
    await query(
      `INSERT INTO shipping_policies (seller_id, handling_days, free_over, default_cost, excluded_regions, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (seller_id) DO UPDATE SET handling_days = $2, free_over = $3, default_cost = $4, excluded_regions = $5, notes = $6, updated_at = NOW()`,
      [auth.user_id, Number(body.handlingDays || 3), body.freeOver || null, Number(body.defaultCost || 0), body.excludedRegions || null, body.notes || null],
    );
    return { status: 200, body: { data: { saved: true } } };
  }

  if (method === "GET" && pathParts[1] && pathParts[2] === "invoice") {
    const order = await loadOrder(pathParts[1], auth);
    if (httpError(order)) return order;
    const fees = await query(`SELECT * FROM order_fees WHERE order_id = $1`, [order.id]);
    const invoiceNumber = `INV-${order.order_number}`;
    const pdf = buildInvoicePdf({ invoiceNumber, order, fees: fees.rows[0] });
    return { status: 200, body: { order, fees: fees.rows[0] || null, invoiceNumber, pdf_base64: pdf.toString("base64") } };
  }

  if (method === "GET" && pathParts[1]) {
    const order = await loadOrder(pathParts[1], auth);
    if (httpError(order)) return order;
    const history = await query(`SELECT * FROM order_history WHERE order_id = $1 ORDER BY created_at`, [order.id]);
    const shipments = await query(`SELECT * FROM shipments WHERE order_id = $1`, [order.id]);
    const escrow = await query(
      `SELECT e.status, e.amount, e.held_at, e.released_at, of.net_to_seller
       FROM escrow_holds e
       LEFT JOIN order_fees of ON of.order_id = e.order_id
       WHERE e.order_id = $1`,
      [order.id],
    );
    return {
      status: 200,
      body: {
        order,
        history: history.rows,
        shipments: shipments.rows,
        you: order.you,
        escrow: escrow.rows[0] || null,
      },
    };
  }

  if (method === "POST" && pathParts[1] && pathParts[2] === "ship") {
    const order = await loadOrder(pathParts[1], auth, "seller");
    if (httpError(order)) return order;
    if (!["paid", "processing"].includes(order.status)) {
      return { status: 400, body: { error: "Only paid orders can be shipped" } };
    }
    await query(
      `UPDATE order_items SET status = 'shipped', tracking_number = $2, carrier = $3, shipped_at = NOW()
       WHERE order_id = $1 AND seller_id = $4`,
      [order.id, body.trackingNumber || null, body.carrier || null, auth.user_id],
    );
    await query(`UPDATE orders SET status = 'shipped', shipped_at = NOW() WHERE id = $1`, [order.id]);
    const shipment = await query(
      `INSERT INTO shipments (order_id, seller_id, carrier, tracking_number, status, shipped_at)
       VALUES ($1,$2,$3,$4,'shipped', NOW()) RETURNING id`,
      [order.id, auth.user_id, body.carrier || null, body.trackingNumber || null],
    );
    if (shipment.rows[0]?.id) {
      await query(
        `INSERT INTO tracking_events (shipment_id, status, note)
         VALUES ($1,'shipped',$2)`,
        [shipment.rows[0].id, body.trackingNumber ? `Handed to ${body.carrier || "courier"} · ${body.trackingNumber}` : "Seller marked shipped"],
      ).catch(() => {});
    }
    await query(`INSERT INTO order_history (order_id, status_from, status_to, changed_by, notes) VALUES ($1,$2,'shipped',$3,$4)`, [
      order.id,
      order.status,
      auth.user_id,
      body.trackingNumber ? `Tracking ${body.trackingNumber}` : "Marked shipped",
    ]);
    await notify(order.buyer_id, "shipped", "Order shipped", `Tracking: ${body.trackingNumber || "not provided"}`, `/orders/${order.order_number}`);
    return { status: 200, body: { data: { shipped: true } } };
  }

  if (method === "POST" && pathParts[1] && pathParts[2] === "deliver") {
    const order = await loadOrder(pathParts[1], auth, "buyer");
    if (httpError(order)) return order;
    if (order.status !== "shipped") {
      return { status: 400, body: { error: "Confirm received after the seller ships" } };
    }
    await query(`UPDATE orders SET status = 'delivered', delivered_at = NOW() WHERE id = $1`, [order.id]);
    await query(`UPDATE order_items SET status = 'delivered', delivered_at = NOW() WHERE order_id = $1`, [order.id]);
    await query(
      `INSERT INTO order_history (order_id, status_from, status_to, changed_by, notes) VALUES ($1,'shipped','delivered',$2,'Buyer confirmed received')`,
      [order.id, auth.user_id],
    );
    const finished = await completeAndRelease(order, auth.user_id, "Buyer confirmed received; escrow released");
    await notify(auth.user_id, "delivered", "Delivery confirmed", "Escrow released to the seller. Leave feedback when you are ready.", "/account?tab=feedback");
    return { status: 200, body: { data: { delivered: true, completed: !finished.skipped, escrow: finished.escrow || null, skipped: finished.skipped || false, reason: finished.reason } } };
  }

  if (method === "POST" && pathParts[1] && pathParts[2] === "complete") {
    const order = await loadOrder(pathParts[1], auth);
    if (httpError(order)) return order;
    if (!["delivered", "shipped"].includes(order.status)) {
      return { status: 400, body: { error: "Complete after the order is received" } };
    }
    const finished = await completeAndRelease(order, auth.user_id, "Order completed; escrow released");
    if (finished.skipped) {
      return { status: 409, body: { error: finished.reason === "frozen" ? "Escrow is frozen on a return or dispute" : "An open case is blocking completion" } };
    }
    return { status: 200, body: { data: { completed: true, escrow: finished.escrow || null } } };
  }

  if (method === "POST" && pathParts[1] && pathParts[2] === "cancel") {
    const order = await loadOrder(pathParts[1], auth);
    if (httpError(order)) return order;
    if (!["pending_payment", "paid", "processing"].includes(order.status)) {
      return { status: 400, body: { error: "This order can no longer be cancelled" } };
    }
    await query(
      `INSERT INTO cancellation_requests (order_id, requested_by, role, reason, status)
       VALUES ($1,$2,$3,$4,'approved')`,
      [order.id, auth.user_id, Number(order.buyer_id) === Number(auth.user_id) ? "buyer" : "seller", body.reason || "Cancelled"],
    );
    await query(`UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $2, cancellation_reason = $3 WHERE id = $1`, [
      order.id,
      auth.user_id,
      body.reason || "Cancelled",
    ]);
    if (order.status === "paid") {
      const { refundOrder } = await import("./ledger.mjs");
      await refundOrder(order.id, order.total_amount, body.reason || "Cancellation", auth.user_id);
    }
    return { status: 200, body: { data: { cancelled: true } } };
  }

  return { status: 404, body: { error: "Not found" } };
}

async function loadOrder(idOrNumber, auth, role) {
  const { rows } = await query(
    `SELECT o.*, json_agg(oi.*) AS items
     FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.id::text = $1 OR o.order_number = $1
     GROUP BY o.id`,
    [String(idOrNumber)],
  );
  const order = rows[0];
  if (!order) return { status: 404, body: { error: "Order not found" } };
  const sellerIds = (order.items || []).map((i) => Number(i && i.seller_id)).filter(Boolean);
  const isBuyer = Number(order.buyer_id) === Number(auth.user_id);
  const isSeller = sellerIds.includes(Number(auth.user_id));
  if (!isBuyer && !isSeller && !auth.is_staff) return { status: 403, body: { error: "Not your order" } };
  if (role === "seller" && !isSeller && !auth.is_staff) return { status: 403, body: { error: "Seller only" } };
  if (role === "buyer" && !isBuyer && !auth.is_staff) return { status: 403, body: { error: "Buyer only" } };
  order.you = { isBuyer, isSeller, isStaff: Boolean(auth.is_staff) };
  return order;
}

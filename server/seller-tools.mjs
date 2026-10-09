import { query } from "./db.mjs";

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function handleSellerTools(method, pathParts, auth, body) {
  if (pathParts[0] !== "seller") return null;
  if (!auth) return { status: 401, body: { error: "Sign in required" } };

  if (method === "GET" && pathParts[1] === "dashboard") {
    const [sales, pending, metrics, vacation, lowStock] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(o.total_amount) FILTER (WHERE o.status IN ('paid','processing','shipped','delivered','completed')),0) AS gmv,
           COUNT(*) FILTER (WHERE o.status IN ('paid','processing','shipped','delivered','completed')) AS orders,
           COALESCE(SUM(o.total_amount) FILTER (WHERE o.created_at >= date_trunc('month', NOW()) AND o.status NOT IN ('cancelled','refunded')),0) AS month_gmv
         FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE oi.seller_id = $1`,
        [auth.user_id],
      ),
      query(
        `SELECT COUNT(*)::int AS pending FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE oi.seller_id = $1 AND o.status IN ('paid','processing')`,
        [auth.user_id],
      ),
      query(`SELECT * FROM seller_metrics WHERE user_id = $1`, [auth.user_id]),
      query(`SELECT * FROM vacation_mode WHERE seller_id = $1`, [auth.user_id]),
      query(
        `SELECT COUNT(*)::int AS c FROM listings WHERE seller_id = $1 AND status = 'active' AND quantity <= 2`,
        [auth.user_id],
      ),
    ]);
    const series = await query(
      `SELECT d::date AS day, COALESCE(SUM(o.total_amount),0) AS revenue, COUNT(DISTINCT o.id)::int AS orders
       FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, INTERVAL '1 day') d
       LEFT JOIN orders o ON o.created_at::date = d::date AND o.status NOT IN ('cancelled','refunded')
       LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.seller_id = $1
       GROUP BY d ORDER BY d`,
      [auth.user_id],
    );
    const wallet = await query(`SELECT * FROM seller_wallets WHERE user_id = $1`, [auth.user_id]);
    return {
      status: 200,
      body: {
        sales: sales.rows[0],
        pendingOrders: pending.rows[0]?.pending || 0,
        lowStock: lowStock.rows[0]?.c || 0,
        metrics: metrics.rows[0] || { defect_rate: 0, late_shipment_rate: 0, cancellation_rate: 0 },
        vacation: vacation.rows[0] || { active: false },
        series: series.rows,
        wallet: wallet.rows[0] || { available_balance: 0, pending_balance: 0 },
        sellerLevel: auth.seller_level,
      },
    };
  }

  if (pathParts[1] === "inventory" && method === "GET") {
    const { rows } = await query(
      `SELECT l.id, l.title, l.price, l.quantity, l.status, l.format, l.view_count, l.watch_count, l.moderation_status,
              (SELECT url FROM listing_photos WHERE listing_id = l.id ORDER BY is_primary DESC, position LIMIT 1) AS photo
       FROM listings l WHERE l.seller_id = $1 AND l.status <> 'removed'
       ORDER BY l.updated_at DESC LIMIT 200`,
      [auth.user_id],
    );
    return { status: 200, body: { data: rows } };
  }

  if (pathParts[1] === "inventory" && pathParts[2] === "bulk" && method === "POST") {
    const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
    if (!items.length) return { status: 400, body: { error: "Add at least one listing" } };
    for (const item of items) {
      const fields = [];
      const values = [];
      let i = 1;
      if (item.price != null) {
        fields.push(`price = $${i++}`);
        values.push(Number(item.price));
      }
      if (item.quantity != null) {
        fields.push(`quantity = $${i++}`);
        values.push(Number(item.quantity));
      }
      if (!fields.length) continue;
      values.push(item.id, auth.user_id);
      await query(
        `UPDATE listings SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${i++} AND seller_id = $${i}`,
        values,
      );
    }
    return { status: 200, body: { data: { updated: items.length } } };
  }

  if (pathParts[1] === "vacation" && method === "GET") {
    const { rows } = await query(`SELECT * FROM vacation_mode WHERE seller_id = $1`, [auth.user_id]);
    return { status: 200, body: { data: rows[0] || { active: false, hide_listings: true, auto_reply: true, message: "" } } };
  }

  if (pathParts[1] === "vacation" && method === "PUT") {
    const active = Boolean(body.active);
    await query(
      `INSERT INTO vacation_mode (seller_id, active, starts_at, ends_at, message, hide_listings, auto_reply)
       VALUES ($1,$2, CASE WHEN $2 THEN NOW() ELSE NULL END, $3, $4, $5, $6)
       ON CONFLICT (seller_id) DO UPDATE SET
         active = EXCLUDED.active,
         starts_at = CASE WHEN EXCLUDED.active THEN COALESCE(vacation_mode.starts_at, NOW()) ELSE NULL END,
         ends_at = EXCLUDED.ends_at,
         message = EXCLUDED.message,
         hide_listings = EXCLUDED.hide_listings,
         auto_reply = EXCLUDED.auto_reply,
         updated_at = NOW()`,
      [auth.user_id, active, body.endsAt || null, String(body.message || "").slice(0, 500), body.hideListings !== false, body.autoReply !== false],
    );
    return { status: 200, body: { data: { saved: true, active } } };
  }

  if (pathParts[1] === "replies" && method === "GET") {
    const { rows } = await query(`SELECT * FROM saved_replies WHERE seller_id = $1 ORDER BY created_at DESC`, [auth.user_id]);
    return { status: 200, body: { data: rows } };
  }

  if (pathParts[1] === "replies" && method === "POST") {
    const title = String(body.title || "").trim();
    const text = String(body.body || "").trim();
    if (!title || !text) return { status: 400, body: { error: "Title and message required" } };
    const inserted = await query(
      `INSERT INTO saved_replies (seller_id, title, body) VALUES ($1,$2,$3) RETURNING *`,
      [auth.user_id, title.slice(0, 80), text.slice(0, 2000)],
    );
    return { status: 201, body: { data: inserted.rows[0] } };
  }

  if (pathParts[1] === "replies" && pathParts[2] && method === "DELETE") {
    await query(`DELETE FROM saved_replies WHERE public_id::text = $1 AND seller_id = $2`, [pathParts[2], auth.user_id]);
    return { status: 200, body: { data: { deleted: true } } };
  }

  if (pathParts[1] === "reports" && method === "GET") {
    const kind = pathParts[2] || "sales";
    let rows = [];
    if (kind === "fees") {
      rows = (await query(
        `SELECT o.order_number, of.commission, of.final_value_fee, of.insertion_fee, of.processing_fee, of.net_to_seller, of.created_at
         FROM order_fees of JOIN orders o ON o.id = of.order_id
         JOIN order_items oi ON oi.order_id = o.id WHERE oi.seller_id = $1
         ORDER BY of.created_at DESC LIMIT 200`,
        [auth.user_id],
      )).rows;
    } else if (kind === "payouts") {
      rows = (await query(`SELECT public_id, amount, method, status, created_at FROM payouts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`, [auth.user_id])).rows;
    } else if (kind === "returns") {
      rows = (await query(
        `SELECT r.public_id, o.order_number, r.reason, r.status, r.amount, r.requested_at
         FROM returns r JOIN orders o ON o.id = r.order_id WHERE r.seller_id = $1 ORDER BY r.requested_at DESC LIMIT 200`,
        [auth.user_id],
      )).rows;
    } else {
      rows = (await query(
        `SELECT o.order_number, o.status, o.total_amount, o.created_at, oi.title
         FROM orders o JOIN order_items oi ON oi.order_id = o.id
         WHERE oi.seller_id = $1 ORDER BY o.created_at DESC LIMIT 200`,
        [auth.user_id],
      )).rows;
    }
    if (String(body.format || "").toLowerCase() === "json" || !rows[0]) {
      /* keep */
    }
    const keys = rows[0] ? Object.keys(rows[0]) : [];
    const csv = [keys.join(","), ...rows.map((row) => keys.map((k) => csvEscape(row[k])).join(","))].join("\n");
    return { status: 200, body: { data: rows, csv, kind } };
  }

  if (pathParts[1] === "label" && method === "GET") {
    const orderId = pathParts[2];
    const { rows } = await query(
      `SELECT o.order_number, o.shipping_name, o.shipping_address_line1, o.shipping_city, oi.title, oi.quantity
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       WHERE (o.id::text = $1 OR o.order_number = $1) AND oi.seller_id = $2 LIMIT 1`,
      [orderId, auth.user_id],
    );
    if (!rows[0]) return { status: 404, body: { error: "Order not found" } };
    const r = rows[0];
    const html = `<!doctype html><html><body style="font-family:sans-serif;padding:24px">
      <h1>Nexlo packing slip</h1>
      <p><strong>${r.order_number}</strong></p>
      <p>${r.shipping_name || ""}<br>${r.shipping_address_line1 || ""}<br>${r.shipping_city || ""}</p>
      <p>${r.title} × ${r.quantity}</p>
      <p style="margin-top:40px;font-size:12px;color:#666">Generated by Nexlo seller tools</p>
      <script>window.print()</script></body></html>`;
    return { status: 200, body: { html, order: r } };
  }

  return { status: 404, body: { error: "Not found" } };
}

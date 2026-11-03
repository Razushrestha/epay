import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "./passwords.mjs";
import { pool, initDb } from "./db.mjs";
import { cdnOrigin, storageOrigin } from "./cdn.mjs";

const API = "/api/v1";

async function db() {
  if (!pool) await initDb();
  return pool;
}

async function safe(sql, params = []) {
  try {
    return await (await db()).query(sql, params);
  } catch (err) {
    console.warn("[staff]", err.message);
    return { rows: [] };
  }
}

export async function loadAdminQueues() {
  const [
    pendingKyc,
    pendingAppeals,
    pendingPayouts,
    openDisputes,
    openTickets,
    flaggedListings,
    unreadMessages,
  ] = await Promise.all([
    safe(`SELECT COUNT(*)::int AS c FROM kyc_documents WHERE status = 'pending'`),
    safe(`SELECT COUNT(*)::int AS c FROM appeals WHERE status = 'pending'`),
    safe(`SELECT COUNT(*)::int AS c FROM payouts WHERE status = 'pending'`),
    safe(`SELECT COUNT(*)::int AS c FROM cases WHERE status IN ('open','awaiting_seller','awaiting_buyer','escalated')`),
    safe(`SELECT COUNT(*)::int AS c FROM support_tickets WHERE status IN ('open','pending','assigned')`),
    safe(`SELECT COUNT(*)::int AS c FROM listings WHERE status = 'pending_review' OR moderation_status = 'flagged'`),
    safe(`SELECT COUNT(*)::int AS c FROM listing_questions WHERE answer IS NULL`),
  ]);
  return {
    kyc: n(pendingKyc.rows[0]?.c),
    appeals: n(pendingAppeals.rows[0]?.c),
    payouts: n(pendingPayouts.rows[0]?.c),
    disputes: n(openDisputes.rows[0]?.c),
    tickets: n(openTickets.rows[0]?.c),
    moderation: n(flaggedListings.rows[0]?.c),
    messages: n(unreadMessages.rows[0]?.c),
  };
}

export async function attachAdminQueuesStream(req, res, searchParams) {
  const token = String(searchParams.get("access_token") || searchParams.get("token") || "").trim();
  if (!token) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Sign in required" }));
    return;
  }
  const hash = createHash("sha256").update(token).digest("hex");
  const session = await safe(
    `SELECT u.id, u.is_staff, u.staff_role
     FROM auth_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW() AND u.deleted_at IS NULL`,
    [hash],
  );
  if (!session.rows[0]?.is_staff) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Staff only" }));
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write(": connected\n\n");

  let closed = false;
  const push = async () => {
    if (closed) return;
    try {
      const queues = await loadAdminQueues();
      res.write(`event: queues\ndata: ${JSON.stringify({ queues, at: new Date().toISOString() })}\n\n`);
    } catch (err) {
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ error: err.message || "queue refresh failed" })}\n\n`);
      } catch {
        /* closed */
      }
    }
  };

  await push();
  const tick = setInterval(push, 8000);
  const ping = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(ping);
    }
  }, 15000);

  const cleanup = () => {
    closed = true;
    clearInterval(tick);
    clearInterval(ping);
  };
  req.on("close", cleanup);
  req.on("aborted", cleanup);
}

function n(value) {
  return Number(value ?? 0) || 0;
}

function pct(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}


export async function handleStaffExtras(req, res, ctx, actor) {
  const { json, readJson, pathname, method, searchParams } = ctx;
  if (!pathname.startsWith(`${API}/admin`) || !actor?.is_staff) return false;

  if (pathname === `${API}/admin/overview` && method === "GET") {
    const days = Math.min(90, Math.max(7, Number(searchParams.get("days") || 7)));
    const [
      usersNow,
      usersPrev,
      ordersNow,
      ordersPrev,
      productsNow,
      productsPrev,
      revenueNow,
      revenuePrev,
      series,
      statuses,
      recentOrders,
      activityUsers,
      activityOrders,
      activityListings,
      activityQuestions,
      unread,
      pendingKyc,
      pendingAppeals,
      pendingPayouts,
      openDisputes,
      openTickets,
      flaggedListings,
    ] = await Promise.all([
      safe(`SELECT COUNT(*)::int AS c FROM users WHERE deleted_at IS NULL`),
      safe(`SELECT COUNT(*)::int AS c FROM users WHERE deleted_at IS NULL AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month') AND created_at < date_trunc('month', NOW())`),
      safe(`SELECT COUNT(*)::int AS c FROM orders`),
      safe(`SELECT COUNT(*)::int AS c FROM orders WHERE created_at >= date_trunc('month', NOW() - INTERVAL '1 month') AND created_at < date_trunc('month', NOW())`),
      safe(`SELECT COUNT(*)::int AS c FROM listings WHERE status <> 'removed'`),
      safe(`SELECT COUNT(*)::int AS c FROM listings WHERE status <> 'removed' AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month') AND created_at < date_trunc('month', NOW())`),
      safe(`SELECT COALESCE(SUM(total_amount),0) AS c FROM orders WHERE status IN ('paid','processing','shipped','delivered','completed')`),
      safe(`SELECT COALESCE(SUM(total_amount),0) AS c FROM orders WHERE status IN ('paid','processing','shipped','delivered','completed') AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month') AND created_at < date_trunc('month', NOW())`),
      safe(
        `SELECT d::date AS day,
                (SELECT COUNT(*)::int FROM users u WHERE u.deleted_at IS NULL AND u.created_at::date = d::date) AS users,
                (SELECT COUNT(*)::int FROM orders o WHERE o.created_at::date = d::date) AS orders,
                (SELECT COUNT(*)::int FROM listings l WHERE l.created_at::date = d::date) AS products,
                (SELECT COALESCE(SUM(o.total_amount),0) FROM orders o WHERE o.created_at::date = d::date AND o.status NOT IN ('cancelled','refunded')) AS revenue
         FROM generate_series((CURRENT_DATE - ($1::int - 1)), CURRENT_DATE, INTERVAL '1 day') d`,
        [days],
      ),
      safe(`SELECT status, COUNT(*)::int AS c FROM orders GROUP BY status`),
      safe(`SELECT o.order_number, o.total_amount, o.status, o.created_at,
                   COALESCE(o.shipping_name, p.display_name, u.email, u.phone) AS customer,
                   oi.title AS product, ph.thumbnail_url, ph.url AS photo_url
            FROM orders o
            JOIN users u ON u.id = o.buyer_id
            LEFT JOIN user_profiles p ON p.user_id = u.id
            LEFT JOIN LATERAL (
              SELECT title, listing_id FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1
            ) oi ON TRUE
            LEFT JOIN LATERAL (
              SELECT url, thumbnail_url FROM listing_photos WHERE listing_id = oi.listing_id ORDER BY is_primary DESC, position LIMIT 1
            ) ph ON TRUE
            ORDER BY o.created_at DESC LIMIT 8`),
      safe(`SELECT u.created_at, COALESCE(p.display_name, u.email, u.phone) AS label
            FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
            WHERE u.deleted_at IS NULL ORDER BY u.created_at DESC LIMIT 5`),
      safe(`SELECT created_at, order_number, status FROM orders ORDER BY created_at DESC LIMIT 5`),
      safe(`SELECT created_at, title FROM listings ORDER BY created_at DESC LIMIT 5`),
      safe(`SELECT q.created_at, q.question, COALESCE(p.display_name, u.email) AS label
            FROM listing_questions q
            JOIN users u ON u.id = q.asker_id
            LEFT JOIN user_profiles p ON p.user_id = u.id
            ORDER BY q.created_at DESC LIMIT 5`),
      safe(`SELECT COUNT(*)::int AS c FROM listing_questions WHERE answer IS NULL`),
      safe(`SELECT COUNT(*)::int AS c FROM kyc_documents WHERE status = 'pending'`),
      safe(`SELECT COUNT(*)::int AS c FROM appeals WHERE status = 'pending'`),
      safe(`SELECT COUNT(*)::int AS c FROM payouts WHERE status = 'pending'`),
      safe(`SELECT COUNT(*)::int AS c FROM cases WHERE status IN ('open','awaiting_seller','awaiting_buyer','escalated')`),
      safe(`SELECT COUNT(*)::int AS c FROM support_tickets WHERE status IN ('open','pending','assigned')`),
      safe(`SELECT COUNT(*)::int AS c FROM listings WHERE status = 'pending_review' OR moderation_status = 'flagged'`),
    ]);

    const thisMonthUsers = n((await safe(`SELECT COUNT(*)::int AS c FROM users WHERE deleted_at IS NULL AND created_at >= date_trunc('month', NOW())`)).rows[0]?.c);
    const thisMonthOrders = n((await safe(`SELECT COUNT(*)::int AS c FROM orders WHERE created_at >= date_trunc('month', NOW())`)).rows[0]?.c);
    const thisMonthProducts = n((await safe(`SELECT COUNT(*)::int AS c FROM listings WHERE status <> 'removed' AND created_at >= date_trunc('month', NOW())`)).rows[0]?.c);
    const thisMonthRevenue = n((await safe(`SELECT COALESCE(SUM(total_amount),0) AS c FROM orders WHERE status IN ('paid','processing','shipped','delivered','completed') AND created_at >= date_trunc('month', NOW())`)).rows[0]?.c);

    const statusMap = Object.fromEntries((statuses.rows || []).map((row) => [row.status, n(row.c)]));
    const completed = n(statusMap.completed) + n(statusMap.delivered);
    const processing = n(statusMap.processing) + n(statusMap.paid) + n(statusMap.shipped);
    const pending = n(statusMap.pending_payment);
    const cancelled = n(statusMap.cancelled) + n(statusMap.refunded);
    const orderTotal = completed + processing + pending + cancelled || n(ordersNow.rows[0]?.c);

    const activity = [
      ...activityUsers.rows.map((row) => ({ kind: "user", title: "New user registered", detail: row.label, at: row.created_at })),
      ...activityOrders.rows.map((row) => ({
        kind: row.status === "refunded" || row.status === "cancelled" ? "refund" : "order",
        title: row.status === "refunded" ? "Refund requested" : `Order #${row.order_number}`,
        detail: row.status === "refunded" ? `Order #${row.order_number}` : `has been ${row.status}`,
        at: row.created_at,
      })),
      ...activityListings.rows.map((row) => ({ kind: "product", title: "New product added", detail: row.title, at: row.created_at })),
      ...activityQuestions.rows.map((row) => ({ kind: "message", title: "Message received", detail: `${row.label}: ${row.question}`, at: row.created_at })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);

    return json(req, res, 200, {
      stats: {
        users: { total: n(usersNow.rows[0]?.c), change: pct(thisMonthUsers, n(usersPrev.rows[0]?.c)) },
        orders: { total: n(ordersNow.rows[0]?.c), change: pct(thisMonthOrders, n(ordersPrev.rows[0]?.c)) },
        products: { total: n(productsNow.rows[0]?.c), change: pct(thisMonthProducts, n(productsPrev.rows[0]?.c)) },
        revenue: { total: n(revenueNow.rows[0]?.c), change: pct(thisMonthRevenue, n(revenuePrev.rows[0]?.c)) },
      },
      series: (series.rows || []).map((row) => ({
        day: row.day,
        users: n(row.users),
        orders: n(row.orders),
        products: n(row.products),
        revenue: n(row.revenue),
      })),
      orderStatus: { completed, processing, pending, cancelled, total: orderTotal },
      recentOrders: recentOrders.rows || [],
      activity,
      unreadMessages: n(unread.rows[0]?.c),
      pendingKyc: n(pendingKyc.rows[0]?.c),
      pendingAppeals: n(pendingAppeals.rows[0]?.c),
      queues: {
        kyc: n(pendingKyc.rows[0]?.c),
        appeals: n(pendingAppeals.rows[0]?.c),
        payouts: n(pendingPayouts.rows[0]?.c),
        disputes: n(openDisputes.rows[0]?.c),
        tickets: n(openTickets.rows[0]?.c),
        moderation: n(flaggedListings.rows[0]?.c),
        messages: n(unread.rows[0]?.c),
      },
    });
  }

  if (pathname === `${API}/admin/listings` && method === "GET") {
    const { denyUnless } = await import("./rbac.mjs");
    const { pageParams, listEnvelope } = await import("./admin-list.mjs");
    const denied = await denyUnless(actor, "listings", "read");
    if (denied) return json(req, res, denied.status, denied.body);
    const q = `%${String(searchParams.get("q") ?? "").trim().toLowerCase()}%`;
    const status = String(searchParams.get("status") ?? "").trim();
    const { page, pageSize, offset } = pageParams(searchParams, 80);
    const where = `WHERE ($1 = '%%' OR lower(l.title) LIKE $1 OR lower(COALESCE(p.display_name, u.email, '')) LIKE $1)
         AND ($2 = '' OR l.status = $2 OR l.moderation_status = $2)`;
    const count = await safe(
      `SELECT COUNT(*)::int AS c
       FROM listings l
       JOIN users u ON u.id = l.seller_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       ${where}`,
      [q, status],
    );
    const { rows } = await safe(
      `SELECT l.id, l.title, l.price, l.status, l.moderation_status, l.format, l.quantity,
              l.is_featured, l.view_count, l.created_at, l.published_at, l.moderation_reason,
              l.auction_ends_at, l.auction_current_price, l.auction_bid_count,
              u.public_id AS seller_id, COALESCE(p.display_name, u.email, u.username) AS seller,
              c.name AS category, ph.thumbnail_url, ph.url AS photo_url
       FROM listings l
       JOIN users u ON u.id = l.seller_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN categories c ON c.id = l.category_id
       LEFT JOIN LATERAL (
         SELECT url, thumbnail_url FROM listing_photos WHERE listing_id = l.id ORDER BY is_primary DESC, position LIMIT 1
       ) ph ON TRUE
       ${where}
       ORDER BY l.created_at DESC LIMIT $3 OFFSET $4`,
      [q, status, pageSize, offset],
    );
    return json(req, res, 200, listEnvelope(rows, { page, pageSize, total: count.rows[0]?.c || 0 }));
  }

  const listingMatch = pathname.match(new RegExp(`^${API}/admin/listings/(\\d+)$`));
  if (listingMatch && method === "PATCH") {
    const { denyUnless, audit } = await import("./rbac.mjs");
    const denied = await denyUnless(actor, "listings", "write");
    if (denied) return json(req, res, denied.status, denied.body);
    const body = await readJson(req);
    const listingId = listingMatch[1];
    if (body.forceEndAuction) {
      await (await db()).query(
        `UPDATE listings SET auction_ends_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND format IN ('auction','both') AND status = 'active'`,
        [listingId],
      );
      try {
        const { settleAuction } = await import("./auctions.mjs");
        await settleAuction(Number(listingId));
      } catch (err) {
        console.warn("[staff] force-end auction", err.message);
      }
      await audit(actor, "listing.force_end", "listing", listingId, { reason: body.reason || null });
      return json(req, res, 200, { data: { id: listingId, forceEnded: true } });
    }
    const fields = [];
    const values = [];
    let i = 1;
    if (body.status) {
      fields.push(`status = $${++i}`);
      values.push(body.status);
    }
    if (body.moderationStatus) {
      if (["rejected", "flagged"].includes(body.moderationStatus) && String(body.reason || "").trim().length < 3) {
        return json(req, res, 400, { error: "A reason is required when rejecting or flagging" });
      }
      fields.push(`moderation_status = $${++i}`, `moderated_by = $${++i}`, "moderated_at = NOW()");
      values.push(body.moderationStatus, actor.id);
      if (body.reason) {
        fields.push(`moderation_reason = $${++i}`);
        values.push(body.reason);
      }
    }
    if (typeof body.featured === "boolean") {
      fields.push(`is_featured = $${++i}`);
      values.push(body.featured);
    }
    if (!fields.length) return json(req, res, 400, { error: "Nothing to update" });
    await (await db()).query(`UPDATE listings SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $1`, [listingId, ...values]);
    await audit(actor, "listing.moderate", "listing", listingId, body);
    return json(req, res, 200, { data: { id: listingId } });
  }

  if (pathname === `${API}/admin/orders` && method === "GET") {
    const { denyUnless } = await import("./rbac.mjs");
    const { pageParams, listEnvelope } = await import("./admin-list.mjs");
    const denied = await denyUnless(actor, "orders", "read");
    if (denied) return json(req, res, denied.status, denied.body);
    const q = `%${String(searchParams.get("q") ?? "").trim().toLowerCase()}%`;
    const status = String(searchParams.get("status") ?? "").trim();
    const { page, pageSize, offset } = pageParams(searchParams, 80);
    const where = `WHERE ($1 = '%%' OR lower(o.order_number) LIKE $1 OR lower(COALESCE(o.shipping_name, p.display_name, u.email, '')) LIKE $1)
         AND ($2 = '' OR o.status = $2)`;
    const count = await safe(
      `SELECT COUNT(*)::int AS c
       FROM orders o
       JOIN users u ON u.id = o.buyer_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       ${where}`,
      [q, status],
    );
    const { rows } = await safe(
      `SELECT o.id, o.order_number, o.total_amount, o.status, o.created_at, o.paid_at,
              COALESCE(o.shipping_name, p.display_name, u.email) AS customer,
              u.email AS customer_email, u.public_id AS buyer_id,
              oi.title AS product, oi.quantity, ph.thumbnail_url, ph.url AS photo_url
       FROM orders o
       JOIN users u ON u.id = o.buyer_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT title, quantity, listing_id FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1
       ) oi ON TRUE
       LEFT JOIN LATERAL (
         SELECT url, thumbnail_url FROM listing_photos WHERE listing_id = oi.listing_id ORDER BY is_primary DESC, position LIMIT 1
       ) ph ON TRUE
       ${where}
       ORDER BY o.created_at DESC LIMIT $3 OFFSET $4`,
      [q, status, pageSize, offset],
    );
    return json(req, res, 200, listEnvelope(rows, { page, pageSize, total: count.rows[0]?.c || 0 }));
  }

  const orderMatch = pathname.match(new RegExp(`^${API}/admin/orders/(\\d+)$`));
  if (orderMatch && method === "PATCH") {
    const { denyUnless, audit } = await import("./rbac.mjs");
    const denied = await denyUnless(actor, "orders", "write");
    if (denied) return json(req, res, denied.status, denied.body);
    const body = await readJson(req);
    const allowed = ["pending_payment", "paid", "processing", "shipped", "delivered", "completed", "cancelled", "refunded"];
    if (!allowed.includes(body.status)) return json(req, res, 400, { error: "Unknown order status" });
    if ((body.status === "refunded" || body.status === "cancelled") && String(body.notes || "").trim().length < 3) {
      return json(req, res, 400, { error: "A note is required when cancelling or refunding" });
    }
    const extra =
      body.status === "shipped"
        ? ", shipped_at = COALESCE(shipped_at, NOW())"
        : body.status === "delivered" || body.status === "completed"
          ? ", delivered_at = COALESCE(delivered_at, NOW()), completed_at = COALESCE(completed_at, NOW())"
          : body.status === "cancelled" || body.status === "refunded"
            ? ", cancelled_at = COALESCE(cancelled_at, NOW())"
            : body.status === "paid"
              ? ", paid_at = COALESCE(paid_at, NOW())"
              : "";
    const current = await safe(`SELECT status FROM orders WHERE id = $1`, [orderMatch[1]]);
    if (!current.rows[0]) return json(req, res, 404, { error: "Order not found" });
    await (await db()).query(
      `UPDATE orders SET status = $2, admin_notes = COALESCE($3, admin_notes) ${extra} WHERE id = $1`,
      [orderMatch[1], body.status, body.notes ?? null],
    );
    await safe(
      `INSERT INTO order_history (order_id, status_from, status_to, changed_by, notes) VALUES ($1, $2, $3, $4, $5)`,
      [orderMatch[1], current.rows[0].status, body.status, actor.id, body.notes || `Staff set status to ${body.status}`],
    );
    try {
      if (body.status === "paid" && current.rows[0].status === "pending_payment") {
        const { onOrderPaid } = await import("./ledger.mjs");
        await onOrderPaid(orderMatch[1]);
      }
      if (body.status === "completed") {
        const { releaseEscrow } = await import("./ledger.mjs");
        await releaseEscrow(orderMatch[1]);
      }
      if (body.status === "refunded") {
        const { refundOrder } = await import("./ledger.mjs");
        await refundOrder(orderMatch[1], null, body.notes || "Staff refund", actor.id);
      }
    } catch (err) {
      console.warn("[staff] ledger hook", err.message);
    }
    await audit(actor, "order.status", "order", orderMatch[1], { status: body.status, notes: body.notes || null });
    return json(req, res, 200, { data: { id: orderMatch[1], status: body.status } });
  }

  if (pathname === `${API}/admin/messages` && method === "GET") {
    const { denyUnless } = await import("./rbac.mjs");
    const denied = await denyUnless(actor, "messages", "read");
    if (denied) return json(req, res, denied.status, denied.body);
    const { rows } = await safe(
      `SELECT q.id, q.question, q.answer, q.created_at, q.answered_at, q.is_public,
              l.id AS listing_id, l.title AS listing_title,
              COALESCE(p.display_name, u.email, u.phone) AS from_name, u.email
       FROM listing_questions q
       JOIN listings l ON l.id = q.listing_id
       JOIN users u ON u.id = q.asker_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       ORDER BY (q.answer IS NULL) DESC, q.created_at DESC LIMIT 80`,
    );
    return json(req, res, 200, { data: rows });
  }

  const messageMatch = pathname.match(new RegExp(`^${API}/admin/messages/(\\d+)$`));
  if (messageMatch && method === "POST") {
    const { denyUnless, audit } = await import("./rbac.mjs");
    const denied = await denyUnless(actor, "messages", "write");
    if (denied) return json(req, res, denied.status, denied.body);
    const body = await readJson(req);
    const answer = String(body.answer ?? "").trim();
    if (!answer) return json(req, res, 400, { error: "Write a reply" });
    await (await db()).query(
      `UPDATE listing_questions SET answer = $2, answered_by = $3, answered_at = NOW() WHERE id = $1`,
      [messageMatch[1], answer, actor.id],
    );
    await audit(actor, "message.reply", "listing_question", messageMatch[1], {});
    return json(req, res, 200, { data: { id: messageMatch[1] } });
  }
  if (messageMatch && method === "PATCH") {
    const { denyUnless, audit } = await import("./rbac.mjs");
    const denied = await denyUnless(actor, "messages", "write");
    if (denied) return json(req, res, denied.status, denied.body);
    const body = await readJson(req);
    if (typeof body.public !== "boolean") return json(req, res, 400, { error: "public boolean required" });
    await (await db()).query(`UPDATE listing_questions SET is_public = $2 WHERE id = $1`, [messageMatch[1], body.public]);
    await audit(actor, body.public ? "message.unhide" : "message.hide", "listing_question", messageMatch[1], {
      reason: body.reason || null,
    });
    return json(req, res, 200, { data: { id: messageMatch[1], public: body.public } });
  }

  if (pathname === `${API}/admin/reviews` && method === "GET") {
    const { denyUnless } = await import("./rbac.mjs");
    const denied = await denyUnless(actor, "reviews", "read");
    if (denied) return json(req, res, denied.status, denied.body);
    await safe(`ALTER TABLE feedback ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE`);
    const { rows } = await safe(
      `SELECT f.public_id, f.rating, f.comment, f.created_at, COALESCE(f.is_hidden, FALSE) AS is_hidden,
              COALESCE(bp.display_name, bu.email) AS from_name,
              COALESCE(sp.display_name, su.email, su.username) AS seller_name,
              su.public_id AS seller_id
       FROM feedback f
       JOIN users bu ON bu.id = f.buyer_id
       JOIN users su ON su.id = f.seller_id
       LEFT JOIN user_profiles bp ON bp.user_id = bu.id
       LEFT JOIN user_profiles sp ON sp.user_id = su.id
       ORDER BY f.created_at DESC LIMIT 80`,
    );
    return json(req, res, 200, { data: rows });
  }

  const reviewMatch = pathname.match(new RegExp(`^${API}/admin/reviews/([^/]+)$`));
  if (reviewMatch && method === "PATCH") {
    const { denyUnless, audit } = await import("./rbac.mjs");
    const denied = await denyUnless(actor, "reviews", "write");
    if (denied) return json(req, res, denied.status, denied.body);
    const body = await readJson(req);
    if (typeof body.hidden !== "boolean") return json(req, res, 400, { error: "hidden boolean required" });
    if (body.hidden && String(body.reason || "").trim().length < 3) {
      return json(req, res, 400, { error: "A reason is required when hiding a review" });
    }
    await safe(`ALTER TABLE feedback ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE`);
    const updated = await safe(`UPDATE feedback SET is_hidden = $2 WHERE public_id::text = $1 RETURNING public_id`, [
      reviewMatch[1],
      body.hidden,
    ]);
    if (!updated.rows[0]) return json(req, res, 404, { error: "Review not found" });
    await audit(actor, body.hidden ? "review.hide" : "review.unhide", "feedback", reviewMatch[1], {
      reason: body.reason || null,
    });
    return json(req, res, 200, { data: { public_id: reviewMatch[1], hidden: body.hidden } });
  }

  if (pathname === `${API}/admin/settings` && method === "GET") {
    const { denyUnless } = await import("./rbac.mjs");
    const denied = await denyUnless(actor, "settings", "read");
    if (denied) return json(req, res, denied.status, denied.body);
    await safe(`CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const { rows } = await safe(`SELECT value FROM platform_settings WHERE key = 'platform'`);
    const stored = rows[0]?.value || {};
    const staff = await safe(
      `SELECT u.public_id, u.email, u.staff_role, COALESCE(p.display_name, u.email) AS name
       FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.is_staff = TRUE AND u.deleted_at IS NULL`,
    );
    return json(req, res, 200, {
      settings: {
        siteName: stored.siteName || "Nexlo",
        currency: stored.currency || "NPR",
        country: stored.country || "Nepal",
        supportEmail: stored.supportEmail || process.env.MAIL_FROM || "",
        maintenance: Boolean(stored.maintenance),
      },
      staff: staff.rows,
    });
  }

  if (pathname === `${API}/admin/settings` && method === "PATCH") {
    const { denyUnless, audit } = await import("./rbac.mjs");
    const denied = await denyUnless(actor, "settings", "write");
    if (denied) return json(req, res, denied.status, denied.body);
    const body = await readJson(req);
    await safe(`CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const payload = {
      siteName: String(body.siteName || "Nexlo").slice(0, 40),
      currency: String(body.currency || "NPR").slice(0, 8),
      country: String(body.country || "Nepal").slice(0, 40),
      supportEmail: String(body.supportEmail || "").slice(0, 120),
      maintenance: Boolean(body.maintenance),
    };
    await (await db()).query(
      `INSERT INTO platform_settings (key, value) VALUES ('platform', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify(payload)],
    );
    await audit(actor, "settings.platform", "platform_settings", "platform", payload);
    return json(req, res, 200, { data: { saved: true } });
  }

  if (pathname === `${API}/admin/search` && method === "GET") {
    // Any authenticated staff may search; results still respect nav modules on the client.
    if (!actor?.is_staff) return json(req, res, 403, { error: "Staff only" });
    const qRaw = String(searchParams.get("q") ?? "").trim();
    if (qRaw.length < 2) return json(req, res, 200, { data: { users: [], orders: [], listings: [] } });
    const q = `%${qRaw.toLowerCase()}%`;
    const [users, orders, listings] = await Promise.all([
      safe(
        `SELECT u.public_id, u.email, u.phone, u.status,
                COALESCE(p.display_name, u.email, u.phone) AS name
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         WHERE u.deleted_at IS NULL
           AND (
             lower(COALESCE(u.email,'')) LIKE $1
             OR lower(COALESCE(u.phone,'')) LIKE $1
             OR lower(COALESCE(p.display_name,'')) LIKE $1
             OR u.public_id::text ILIKE $2
           )
         ORDER BY u.created_at DESC LIMIT 8`,
        [q, `%${qRaw}%`],
      ),
      safe(
        `SELECT o.id, o.order_number, o.status, o.total_amount,
                COALESCE(p.display_name, u.email) AS customer
         FROM orders o
         JOIN users u ON u.id = o.buyer_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
         WHERE lower(o.order_number) LIKE $1 OR lower(COALESCE(p.display_name, u.email, '')) LIKE $1 OR o.id::text = $2
         ORDER BY o.created_at DESC LIMIT 8`,
        [q, qRaw],
      ),
      safe(
        `SELECT l.id, l.title, l.status, l.moderation_status, l.price,
                COALESCE(p.display_name, u.email) AS seller
         FROM listings l
         JOIN users u ON u.id = l.seller_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
         WHERE lower(l.title) LIKE $1 OR l.id::text = $2 OR lower(COALESCE(p.display_name, u.email, '')) LIKE $1
         ORDER BY l.created_at DESC LIMIT 8`,
        [q, qRaw],
      ),
    ]);
    return json(req, res, 200, {
      data: { users: users.rows, orders: orders.rows, listings: listings.rows, q: qRaw },
    });
  }

  if (pathname === `${API}/admin/uat` && method === "GET") {
    const [listings, orders, returns, cases, tickets] = await Promise.all([
      safe(`SELECT COUNT(*)::int AS c FROM listings WHERE status = 'active' AND moderation_status = 'approved'`),
      safe(`SELECT COUNT(*)::int AS c FROM orders`),
      safe(`SELECT COUNT(*)::int AS c FROM returns`),
      safe(`SELECT COUNT(*)::int AS c FROM cases`),
      safe(`SELECT COUNT(*)::int AS c FROM support_tickets`),
    ]);
    return json(req, res, 200, {
      goLive: {
        cdnConfigured: Boolean(cdnOrigin()),
        storageConfigured: Boolean(storageOrigin()),
        apiP95TargetMs: 300,
        searchP95TargetMs: 400,
      },
      counts: {
        activeListings: n(listings.rows[0]?.c),
        orders: n(orders.rows[0]?.c),
        returns: n(returns.rows[0]?.c),
        cases: n(cases.rows[0]?.c),
        tickets: n(tickets.rows[0]?.c),
      },
      commands: { load: "npm run test:load", uat: "npm run test:uat" },
      outOfFee: ["prepaid return labels", "Authenticity Guarantee", "VeRO", "Terapeak"],
    });
  }

  if (pathname === `${API}/admin/users` && method === "POST") {
    const body = await readJson(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) return json(req, res, 400, { error: "A valid email is required" });
    const password = String(body.password || "").length >= 8 ? String(body.password) : `Nexlo${randomBytes(3).toString("hex")}!`;
    const publicId = randomUUID();
    try {
      const inserted = await (await db()).query(
        `INSERT INTO users (public_id, email, password_hash, account_type, status, is_staff, is_seller, email_verified_at)
         VALUES ($1, $2, $3, 'individual', 'active', $4, $5, NOW())
         RETURNING id, public_id`,
        [publicId, email, await hashPassword(password), Boolean(body.staff), Boolean(body.seller)],
      );
      await (await db()).query(
        `INSERT INTO user_profiles (user_id, first_name, last_name, display_name, country)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, display_name = EXCLUDED.display_name`,
        [inserted.rows[0].id, body.firstName || null, body.lastName || null, body.displayName || [body.firstName, body.lastName].filter(Boolean).join(" ") || email.split("@")[0], body.country || "Nepal"],
      );
      return json(req, res, 201, { data: { id: publicId, email, temporaryPassword: body.password ? undefined : password } });
    } catch (err) {
      if (String(err.message).includes("unique")) return json(req, res, 409, { error: "That email is already registered" });
      throw err;
    }
  }

  return false;
}

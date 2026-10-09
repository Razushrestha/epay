import { query } from "./db.mjs";
import { notify } from "./notify.mjs";
import { refundOrder, freezeEscrow, unfreezeEscrow } from "./ledger.mjs";
import { audit } from "./rbac.mjs";
import { protectionOpen } from "./trust.mjs";

async function protectionDays() {
  const { rows } = await query(`SELECT value FROM site_settings WHERE key = 'buyer_protection_days'`);
  const n = Number(rows[0]?.value);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

function isHttp(value) {
  return Boolean(value && typeof value.status === "number" && value.body);
}

async function loadReturn(id, auth) {
  const { rows } = await query(
    `SELECT r.*, o.order_number, o.status AS order_status, o.delivered_at, o.total_amount
     FROM returns r JOIN orders o ON o.id = r.order_id
     WHERE r.id::text = $1 OR r.public_id::text = $1`,
    [String(id)],
  );
  const row = rows[0];
  if (!row) return { status: 404, body: { error: "Return not found" } };
  const mine = Number(row.buyer_id) === Number(auth.user_id) || Number(row.seller_id) === Number(auth.user_id);
  if (!mine && !auth.is_staff) return { status: 403, body: { error: "Not your return" } };
  return row;
}

async function loadCase(id, auth) {
  const { rows } = await query(
    `SELECT c.*, o.order_number FROM cases c JOIN orders o ON o.id = c.order_id
     WHERE c.id::text = $1 OR c.public_id::text = $1`,
    [String(id)],
  );
  const row = rows[0];
  if (!row) return { status: 404, body: { error: "Case not found" } };
  const mine = Number(row.buyer_id) === Number(auth.user_id) || Number(row.seller_id) === Number(auth.user_id);
  if (!mine && !auth.is_staff) return { status: 403, body: { error: "Not your case" } };
  return row;
}

async function openCaseFromReturn(ret, type = "return") {
  const existing = await query(`SELECT * FROM cases WHERE return_id = $1`, [ret.id]);
  if (existing.rows[0]) return existing.rows[0];
  const inserted = await query(
    `INSERT INTO cases (order_id, return_id, buyer_id, seller_id, case_type, amount_claimed, status)
     VALUES ($1,$2,$3,$4,$5,$6,'awaiting_seller') RETURNING *`,
    [ret.order_id, ret.id, ret.buyer_id, ret.seller_id, type, ret.amount],
  );
  await freezeEscrow(ret.order_id);
  await notify(ret.seller_id, "case", "Return / case opened", `Order ${ret.order_number || ret.order_id} needs a response within 3 days.`, "/account?tab=selling");
  return inserted.rows[0];
}

export async function escalateSilentCases() {
  const silent = await query(
    `UPDATE cases SET status = 'escalated', escalated_at = NOW()
     WHERE status IN ('open','awaiting_seller') AND seller_response_due < NOW() AND escalated_at IS NULL
     RETURNING id, buyer_id, seller_id, order_id`,
  );
  for (const row of silent.rows) {
    await query(`UPDATE returns SET status = 'escalated' WHERE order_id = $1 AND status IN ('requested','seller_declined')`, [row.order_id]);
    await notify(row.buyer_id, "case", "Case escalated", "The seller did not respond in time. Nexlo staff will review.", "/account?tab=returns");
    await notify(row.seller_id, "case", "Case escalated", "You missed the response window. Staff will decide.", "/account?tab=selling");
  }
}

export async function handleReturns(method, pathParts, auth, body) {
  if (pathParts[0] !== "returns" && pathParts[0] !== "cases") return null;
  if (!auth) return { status: 401, body: { error: "Sign in required" } };

  if (pathParts[0] === "returns" && method === "GET" && !pathParts[1]) {
    const { rows } = await query(
      `SELECT r.*, o.order_number, oi.title AS item_title
       FROM returns r
       JOIN orders o ON o.id = r.order_id
       LEFT JOIN order_items oi ON oi.id = r.order_item_id
       WHERE r.buyer_id = $1 OR r.seller_id = $1
       ORDER BY r.requested_at DESC LIMIT 80`,
      [auth.user_id],
    );
    return { status: 200, body: { data: rows, protectionDays: await protectionDays() } };
  }

  if (pathParts[0] === "returns" && method === "POST" && !pathParts[1]) {
    const order = await query(
      `SELECT o.*, json_agg(oi.*) AS items
       FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id::text = $1 OR o.order_number = $1 GROUP BY o.id`,
      [String(body.orderId)],
    );
    const row = order.rows[0];
    if (!row) return { status: 404, body: { error: "Order not found" } };
    if (Number(row.buyer_id) !== Number(auth.user_id) && !auth.is_staff) {
      return { status: 403, body: { error: "Only the buyer can open a return" } };
    }
    if (!["delivered", "completed", "shipped"].includes(row.status)) {
      return { status: 400, body: { error: "This order is not eligible for a return yet" } };
    }
    const days = await protectionDays();
    const start = row.delivered_at || row.completed_at || row.shipped_at;
    if (!protectionOpen(start, days) && row.status !== "shipped") {
      return { status: 400, body: { error: `Buyer protection ended (${days} days after delivery)` } };
    }
    const reason = ["not_as_described", "damaged", "wrong_item", "changed_mind", "other"].includes(body.reason) ? body.reason : null;
    if (!reason) return { status: 400, body: { error: "Choose a return reason" } };
    const items = (row.items || []).filter(Boolean);
    const item = items.find((i) => String(i.id) === String(body.itemId)) || items[0];
    if (!item) return { status: 400, body: { error: "No item on this order" } };
    const dup = await query(`SELECT id FROM returns WHERE order_id = $1 AND status NOT IN ('closed','refunded')`, [row.id]);
    if (dup.rows[0]) return { status: 409, body: { error: "A return is already open for this order" } };
    const inserted = await query(
      `INSERT INTO returns (order_id, order_item_id, buyer_id, seller_id, reason, detail, requested_resolution, photos, amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        row.id,
        item.id,
        row.buyer_id,
        item.seller_id,
        reason,
        String(body.detail || "").slice(0, 2000),
        ["refund", "replacement", "partial_refund"].includes(body.resolution) ? body.resolution : "refund",
        JSON.stringify(Array.isArray(body.photos) ? body.photos.slice(0, 8) : []),
        Number(body.amount || row.total_amount),
      ],
    );
    const ret = inserted.rows[0];
    ret.order_number = row.order_number;
    const caseType = reason === "not_as_described" || reason === "damaged" || reason === "wrong_item" ? "inad" : "return";
    const opened = await openCaseFromReturn(ret, row.status === "shipped" && reason === "other" ? "inr" : caseType);
    await notify(item.seller_id, "return", "Return requested", `${row.order_number}: ${reason.replace(/_/g, " ")}`, "/account?tab=selling");
    return { status: 201, body: { data: ret, case: opened } };
  }

  if (pathParts[0] === "returns" && pathParts[1] && method === "GET" && !pathParts[2]) {
    const row = await loadReturn(pathParts[1], auth);
    if (isHttp(row)) return row;
    const ship = await query(`SELECT * FROM return_shipments WHERE return_id = $1`, [row.id]);
    const related = await query(`SELECT * FROM cases WHERE return_id = $1`, [row.id]);
    return { status: 200, body: { return: row, shipments: ship.rows, case: related.rows[0] || null } };
  }

  if (pathParts[0] === "returns" && pathParts[2] === "decide" && method === "POST") {
    const row = await loadReturn(pathParts[1], auth);
    if (isHttp(row)) return row;
    if (Number(row.seller_id) !== Number(auth.user_id) && !auth.is_staff) return { status: 403, body: { error: "Seller only" } };
    const approve = body.approve !== false;
    if (approve) {
      const code = `NEX-RET-${row.id}`;
      await query(`UPDATE returns SET status = 'label_issued', decided_at = NOW() WHERE id = $1`, [row.id]);
      await query(
        `INSERT INTO return_shipments (return_id, carrier, tracking_number, label_code) VALUES ($1,'Nexlo Returns',$2,$2)`,
        [row.id, code],
      );
      await notify(row.buyer_id, "return", "Return approved", `Use label ${code} to ship the item back.`, `/account?tab=returns`);
      return { status: 200, body: { data: { approved: true, labelCode: code } } };
    }
    await query(`UPDATE returns SET status = 'seller_declined', decided_at = NOW() WHERE id = $1`, [row.id]);
    await query(`UPDATE cases SET status = 'escalated', escalated_at = NOW() WHERE return_id = $1`, [row.id]);
    await notify(row.buyer_id, "return", "Return declined", "The seller declined. This case was sent to Nexlo staff.", "/account?tab=returns");
    return { status: 200, body: { data: { approved: false, escalated: true } } };
  }

  if (pathParts[0] === "returns" && pathParts[2] === "ship" && method === "POST") {
    const row = await loadReturn(pathParts[1], auth);
    if (isHttp(row)) return row;
    await query(`UPDATE returns SET status = 'in_transit' WHERE id = $1`, [row.id]);
    await query(
      `UPDATE return_shipments SET shipped_at = NOW(), tracking_number = COALESCE($2, tracking_number) WHERE return_id = $1`,
      [row.id, body.trackingNumber || null],
    );
    await notify(row.seller_id, "return", "Return in transit", "The buyer shipped the item back.", "/account?tab=selling");
    return { status: 200, body: { data: { shipped: true } } };
  }

  if (pathParts[0] === "returns" && pathParts[2] === "receive" && method === "POST") {
    const row = await loadReturn(pathParts[1], auth);
    if (isHttp(row)) return row;
    if (Number(row.seller_id) !== Number(auth.user_id) && !auth.is_staff) return { status: 403, body: { error: "Seller only" } };
    await query(`UPDATE returns SET status = 'received' WHERE id = $1`, [row.id]);
    await query(`UPDATE return_shipments SET received_at = NOW() WHERE return_id = $1`, [row.id]);
    const refund = await refundOrder(row.order_id, row.amount, `Return ${row.public_id}`, auth.user_id);
    await query(`UPDATE returns SET status = 'refunded' WHERE id = $1`, [row.id]);
    await query(`UPDATE cases SET status = 'resolved', closed_at = NOW() WHERE return_id = $1`, [row.id]);
    return refund.status ? refund : { status: 200, body: { data: { refunded: true } } };
  }

  if (pathParts[0] === "cases" && method === "GET" && !pathParts[1]) {
    const { rows } = await query(
      `SELECT c.*, o.order_number FROM cases c JOIN orders o ON o.id = c.order_id
       WHERE c.buyer_id = $1 OR c.seller_id = $1 ORDER BY c.opened_at DESC LIMIT 80`,
      [auth.user_id],
    );
    return { status: 200, body: { data: rows } };
  }

  if (pathParts[0] === "cases" && method === "POST" && !pathParts[1]) {
    const order = await query(`SELECT * FROM orders WHERE id::text = $1 OR order_number = $1`, [String(body.orderId)]);
    const row = order.rows[0];
    if (!row) return { status: 404, body: { error: "Order not found" } };
    if (Number(row.buyer_id) !== Number(auth.user_id) && !auth.is_staff) return { status: 403, body: { error: "Buyer only" } };
    const type = ["inr", "inad", "return", "other"].includes(body.caseType) ? body.caseType : "inr";
    const items = await query(`SELECT seller_id FROM order_items WHERE order_id = $1 LIMIT 1`, [row.id]);
    const sellerId = items.rows[0]?.seller_id;
    if (!sellerId) return { status: 400, body: { error: "No seller on this order" } };
    const inserted = await query(
      `INSERT INTO cases (order_id, buyer_id, seller_id, case_type, amount_claimed, status)
       VALUES ($1,$2,$3,$4,$5,'awaiting_seller') RETURNING *`,
      [row.id, row.buyer_id, sellerId, type, Number(body.amount || row.total_amount)],
    );
    await freezeEscrow(row.id);
    if (body.message) {
      await query(`INSERT INTO case_messages (case_id, sender_id, role, body) VALUES ($1,$2,'buyer',$3)`, [
        inserted.rows[0].id,
        auth.user_id,
        String(body.message).slice(0, 2000),
      ]);
    }
    await notify(sellerId, "case", "Case opened", `${type.toUpperCase()} on ${row.order_number}`, "/account?tab=selling");
    return { status: 201, body: { data: inserted.rows[0] } };
  }

  if (pathParts[0] === "cases" && pathParts[1] && method === "GET" && !pathParts[2]) {
    const row = await loadCase(pathParts[1], auth);
    if (isHttp(row)) return row;
    const messages = await query(`SELECT * FROM case_messages WHERE case_id = $1 ORDER BY created_at`, [row.id]);
    const evidence = await query(`SELECT * FROM case_evidence WHERE case_id = $1 ORDER BY created_at`, [row.id]);
    const decisions = await query(`SELECT * FROM case_decisions WHERE case_id = $1 ORDER BY decided_at`, [row.id]);
    return { status: 200, body: { case: row, messages: messages.rows, evidence: evidence.rows, decisions: decisions.rows } };
  }

  if (pathParts[0] === "cases" && pathParts[2] === "messages" && method === "POST") {
    const row = await loadCase(pathParts[1], auth);
    if (isHttp(row)) return row;
    const text = String(body.body || "").trim();
    if (!text) return { status: 400, body: { error: "Write a message" } };
    const role = auth.is_staff ? "staff" : Number(row.buyer_id) === Number(auth.user_id) ? "buyer" : "seller";
    await query(`INSERT INTO case_messages (case_id, sender_id, role, body) VALUES ($1,$2,$3,$4)`, [row.id, auth.user_id, role, text.slice(0, 4000)]);
    if (role === "seller" && row.status === "awaiting_seller") {
      await query(`UPDATE cases SET status = 'awaiting_buyer' WHERE id = $1`, [row.id]);
    }
    const other = Number(row.buyer_id) === Number(auth.user_id) ? row.seller_id : row.buyer_id;
    await notify(other, "case", "Case update", text.slice(0, 120), "/account?tab=returns");
    return { status: 201, body: { data: { saved: true } } };
  }

  if (pathParts[0] === "cases" && pathParts[2] === "evidence" && method === "POST") {
    const row = await loadCase(pathParts[1], auth);
    if (isHttp(row)) return row;
    const url = String(body.fileUrl || body.url || "").trim();
    if (!url) return { status: 400, body: { error: "Upload a photo or file URL" } };
    await query(`INSERT INTO case_evidence (case_id, uploaded_by, file_url, kind) VALUES ($1,$2,$3,$4)`, [
      row.id,
      auth.user_id,
      url.slice(0, 2000),
      body.kind || "photo",
    ]);
    return { status: 201, body: { data: { saved: true } } };
  }

  if (pathParts[0] === "cases" && pathParts[2] === "decide" && method === "POST") {
    if (!auth.is_staff) return { status: 403, body: { error: "Staff only" } };
    const row = await loadCase(pathParts[1], auth);
    if (isHttp(row)) return row;
    const outcome = ["refund_buyer", "partial_refund", "side_with_seller", "return_item"].includes(body.outcome) ? body.outcome : null;
    if (!outcome) return { status: 400, body: { error: "Choose an outcome" } };
    const amount = Number(body.refundAmount ?? (outcome === "side_with_seller" ? 0 : row.amount_claimed || 0));
    await query(
      `INSERT INTO case_decisions (case_id, decided_by, outcome, refund_amount, seller_penalty, reason) VALUES ($1,$2,$3,$4,$5,$6)`,
      [row.id, auth.user_id, outcome, amount, body.sellerPenalty || null, body.reason || null],
    );
    if (outcome === "refund_buyer" || outcome === "partial_refund") {
      await unfreezeEscrow(row.order_id);
      await refundOrder(row.order_id, amount || null, body.reason || `Case ${row.public_id}`, auth.user_id);
      await query(`UPDATE returns SET status = 'refunded' WHERE id = $1`, [row.return_id]);
    } else {
      await unfreezeEscrow(row.order_id);
      await query(`UPDATE returns SET status = 'closed' WHERE id = $1`, [row.return_id]);
    }
    await query(`UPDATE cases SET status = 'resolved', closed_at = NOW() WHERE id = $1`, [row.id]);
    await audit(auth, "case.decide", "case", row.id, { outcome, amount });
    await notify(row.buyer_id, "case", "Case decided", `Outcome: ${outcome.replace(/_/g, " ")}`, "/account?tab=returns");
    await notify(row.seller_id, "case", "Case decided", `Outcome: ${outcome.replace(/_/g, " ")}`, "/account?tab=selling");
    return { status: 200, body: { data: { outcome, amount } } };
  }

  if (pathParts[0] === "cases" && pathParts[2] === "appeal" && method === "POST") {
    const row = await loadCase(pathParts[1], auth);
    if (isHttp(row)) return row;
    if (row.status !== "resolved") return { status: 400, body: { error: "Only a resolved case can be appealed" } };
    if (row.appeal_used) return { status: 409, body: { error: "Appeal already used" } };
    await query(
      `UPDATE cases SET status = 'appealed', appeal_used = TRUE, closed_at = NULL WHERE id = $1`,
      [row.id],
    );
    await query(`INSERT INTO case_messages (case_id, sender_id, role, body) VALUES ($1,$2,'appeal',$3)`, [
      row.id,
      auth.user_id,
      String(body.message || "I appeal this decision").slice(0, 2000),
    ]);
    await freezeEscrow(row.order_id);
    return { status: 200, body: { data: { appealed: true } } };
  }

  return { status: 404, body: { error: "Not found" } };
}

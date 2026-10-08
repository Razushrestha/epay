import { query } from "./db.mjs";
import { notify } from "./notify.mjs";

const SPAM = /(viagra|casino|crypto.?invest|wire.?transfer|gift.?card)/i;

export async function handleInbox(method, pathParts, auth, body) {
  if (pathParts[0] !== "messages" && pathParts[0] !== "conversations") return null;
  if (!auth) return { status: 401, body: { error: "Sign in required" } };

  if (method === "GET" && (pathParts[0] === "conversations" || (pathParts[0] === "messages" && !pathParts[1]))) {
    const { rows } = await query(
      `SELECT c.*,
              CASE WHEN c.buyer_id = $1 THEN su.email ELSE bu.email END AS counterpart_email,
              CASE WHEN c.buyer_id = $1 THEN sp.display_name ELSE bp.display_name END AS counterpart_name,
              (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
              (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id AND m.sender_id <> $1 AND m.read_at IS NULL) AS unread
       FROM conversations c
       JOIN users bu ON bu.id = c.buyer_id
       JOIN users su ON su.id = c.seller_id
       LEFT JOIN user_profiles bp ON bp.user_id = c.buyer_id
       LEFT JOIN user_profiles sp ON sp.user_id = c.seller_id
       WHERE c.buyer_id = $1 OR c.seller_id = $1
       ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
       LIMIT 80`,
      [auth.user_id],
    );
    return { status: 200, body: { data: rows } };
  }

  if (method === "POST" && pathParts[0] === "conversations" && !pathParts[1]) {
    if (Number(body.sellerId) === Number(auth.user_id)) return { status: 400, body: { error: "You cannot message yourself" } };
    const listingId = body.listingId || null;
    const found = await query(
      `SELECT * FROM conversations WHERE buyer_id = $1 AND seller_id = $2 AND COALESCE(listing_id, 0) = COALESCE($3::bigint, 0)`,
      [auth.user_id, body.sellerId, listingId],
    );
    if (found.rows[0]) return { status: 200, body: { data: found.rows[0] } };
    const inserted = await query(
      `INSERT INTO conversations (buyer_id, seller_id, listing_id, subject)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [auth.user_id, body.sellerId, listingId, body.subject || "Question about an item"],
    );
    return { status: 201, body: { data: inserted.rows[0] } };
  }

  if (method === "GET" && pathParts[0] === "conversations" && pathParts[1] && pathParts[2] === "messages") {
    const convo = await loadConvo(pathParts[1], auth);
    if (convo.status) return convo;
    const { rows } = await query(`SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 200`, [convo.id]);
    await query(
      `UPDATE messages SET read_at = NOW() WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL`,
      [convo.id, auth.user_id],
    );
    return { status: 200, body: { conversation: convo, messages: rows } };
  }

  if (method === "POST" && pathParts[0] === "conversations" && pathParts[1] && pathParts[2] === "messages") {
    const convo = await loadConvo(pathParts[1], auth);
    if (convo.status) return convo;
    const text = String(body.body || "").trim();
    if (text.length < 1) return { status: 400, body: { error: "Write a message" } };
    if (SPAM.test(text)) return { status: 400, body: { error: "Message looks like spam" } };
    const inserted = await query(
      `INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1,$2,$3) RETURNING *`,
      [convo.id, auth.user_id, text],
    );
    await query(`UPDATE conversations SET last_message_at = NOW() WHERE id = $1`, [convo.id]);
    const other = Number(convo.buyer_id) === Number(auth.user_id) ? convo.seller_id : convo.buyer_id;
    await notify(other, "message", "New message", text.slice(0, 120), `/account?tab=messages`);
    return { status: 201, body: { data: inserted.rows[0] } };
  }

  if (method === "POST" && pathParts[0] === "conversations" && pathParts[1] && pathParts[2] === "report") {
    const convo = await loadConvo(pathParts[1], auth);
    if (convo.status) return convo;
    await query(`UPDATE conversations SET flagged = TRUE WHERE id = $1`, [convo.id]);
    return { status: 200, body: { data: { reported: true } } };
  }

  return { status: 404, body: { error: "Not found" } };
}

async function loadConvo(id, auth) {
  const { rows } = await query(`SELECT * FROM conversations WHERE id = $1`, [id]);
  const convo = rows[0];
  if (!convo) return { status: 404, body: { error: "Conversation not found" } };
  if (Number(convo.buyer_id) !== Number(auth.user_id) && Number(convo.seller_id) !== Number(auth.user_id) && !auth.is_staff) {
    return { status: 403, body: { error: "Not your conversation" } };
  }
  return convo;
}

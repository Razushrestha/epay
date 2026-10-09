import { query, withTx } from "./db.mjs";
import { nextOrderNumber } from "./commerce-auth.mjs";
import { incrementFor } from "./commerce-rules.mjs";
import { applyProxyBid, softCloseEndsAt } from "./auctions-math.mjs";
import { notify } from "./notify.mjs";
import { enforceVerification, evaluateUser } from "./trust.mjs";
import { redisPublish } from "./redis.mjs";

const rooms = new Map();

export function broadcastAuction(listingId, payload, { fromRedis = false } = {}) {
  const set = rooms.get(String(listingId));
  if (set) {
    const msg = `event: bid\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of set) {
      try {
        res.write(msg);
      } catch {
        set.delete(res);
      }
    }
  }
  if (!fromRedis) {
    redisPublish(`auction:${listingId}`, payload).catch(() => {});
  }
}

export function attachAuctionStream(req, res, listingId) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write(": connected\n\n");
  const key = String(listingId);
  if (!rooms.has(key)) rooms.set(key, new Set());
  rooms.get(key).add(res);
  const ping = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(ping);
    }
  }, 15000);
  req.on("close", () => {
    clearInterval(ping);
    rooms.get(key)?.delete(res);
  });
}

async function snapshot(listingId) {
  const listing = await query(
    `SELECT l.id, l.title, l.seller_id, l.auction_start_price, l.auction_reserve_price, l.auction_current_price,
            l.auction_bid_count, l.auction_ends_at, l.auction_winner_id, l.status, l.format
     FROM listings l WHERE l.id = $1`,
    [listingId],
  );
  const bids = await query(
    `SELECT b.amount, b.max_amount, b.created_at, COALESCE(p.display_name, u.username, 'Bidder') AS bidder
     FROM bids b JOIN users u ON u.id = b.bidder_id
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE b.listing_id = $1 AND b.retracted = FALSE ORDER BY b.created_at DESC LIMIT 20`,
    [listingId],
  );
  const state = await query(`SELECT * FROM auction_states WHERE listing_id = $1`, [listingId]);
  const inc = await incrementFor(listing.rows[0]?.auction_current_price || listing.rows[0]?.auction_start_price);
  return { listing: listing.rows[0], bids: bids.rows, state: state.rows[0] || null, increment: inc };
}

async function placeProxy(listingId, bidderId, maxAmount) {
  const placed = await withTx(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock($1)`, [Number(listingId)]);
    const { rows } = await client.query(
      `SELECT * FROM listings WHERE id = $1 AND status = 'active' AND format IN ('auction','both') FOR UPDATE`,
      [listingId],
    );
    const listing = rows[0];
    if (!listing) throw new Error("This auction is not live");
    if (Number(listing.seller_id) === Number(bidderId)) throw new Error("Sellers cannot bid on their own item");
    if (listing.auction_ends_at && new Date(listing.auction_ends_at) < new Date()) throw new Error("This auction has ended");
    try {
      const blocked = await client.query(
        `SELECT 1 FROM blocked_bidders WHERE seller_id = $1 AND blocked_user_id = $2`,
        [listing.seller_id, bidderId],
      );
      if (blocked.rows[0]) throw new Error("This seller has blocked you from bidding");
    } catch (err) {
      if (String(err.message).includes("blocked you")) throw err;
    }
    const standing = await client.query(
      `SELECT unpaid_strikes FROM users WHERE id = $1`,
      [bidderId],
    );
    if (Number(standing.rows[0]?.unpaid_strikes || 0) >= 3) throw new Error("Pay outstanding auction wins before bidding again");
    const start = Number(listing.auction_start_price || listing.price || 0);
    const current = Number(listing.auction_current_price || start);
    const inc = await incrementFor(current);
    const minNext = listing.auction_bid_count > 0 ? current + inc : start;
    if (maxAmount < minNext) throw new Error(`Bid at least NPR ${minNext}`);

    const stateRes = await client.query(`SELECT * FROM auction_states WHERE listing_id = $1 FOR UPDATE`, [listingId]);
    const applied = applyProxyBid({
      highId: stateRes.rows[0]?.high_bidder_id || null,
      highMax: Number(stateRes.rows[0]?.high_max || 0),
      price: current,
      start,
      bidderId,
      maxAmount,
      increment: inc,
    });
    let highId = applied.highId;
    let highMax = applied.highMax;
    let price = applied.price;
    const outbidUser = applied.outbidUser;
    const lostLead = applied.lostLead;

    const reserve = Number(listing.auction_reserve_price || 0);
    const wasMet = Boolean(stateRes.rows[0]?.reserve_met);
    const reserveMet = !reserve || price >= reserve;
    await client.query(
      `INSERT INTO bids (listing_id, bidder_id, amount, max_amount, is_proxy) VALUES ($1,$2,$3,$4, TRUE)`,
      [listingId, bidderId, price, maxAmount],
    );
    const count = await client.query(`SELECT COUNT(*)::int AS c FROM bids WHERE listing_id = $1 AND retracted = FALSE`, [listingId]);
    const closed = softCloseEndsAt(
      listing.auction_ends_at,
      Date.now(),
      2 * 60 * 1000,
      5 * 60 * 1000,
      Number(process.env.AUCTION_MAX_EXTENSIONS || 8),
      Number(stateRes.rows[0]?.extension_count || listing.extension_count || 0),
    );
    const endsAt = closed.endsAt;
    await client.query(
      `UPDATE listings SET auction_current_price = $2, auction_bid_count = $3, auction_ends_at = COALESCE($4, auction_ends_at) WHERE id = $1`,
      [listingId, price, count.rows[0].c, endsAt],
    );
    await client.query(
      `INSERT INTO auction_states (listing_id, high_bidder_id, high_max, current_price, bid_count, reserve_met)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (listing_id) DO UPDATE SET high_bidder_id = $2, high_max = $3, current_price = $4, bid_count = $5, reserve_met = $6, updated_at = NOW()`,
      [listingId, highId, highMax, price, count.rows[0].c, reserveMet],
    );
    return { listing, highId, price, outbidUser, lostLead, reserveMet, wasMet };
  });

  const snap = await snapshot(listingId);
  broadcastAuction(listingId, snap);
  await notify(placed.listing.seller_id, "bid", "New bid", `NPR ${placed.price} on ${placed.listing.title}`, `/listing/${listingId}`);
  if (placed.outbidUser) {
    await notify(placed.outbidUser, "outbid", "You were outbid", `Someone bid higher on ${placed.listing.title}.`, `/listing/${listingId}`);
  }
  if (placed.lostLead) {
    await notify(bidderId, "outbid", "Bid not high enough", `Another bidder still leads ${placed.listing.title}.`, `/listing/${listingId}`);
  }
  if (placed.reserveMet && !placed.wasMet) {
    await notify(placed.listing.seller_id, "reserve_met", "Reserve met", `${placed.listing.title} has met the reserve.`, `/listing/${listingId}`);
  }
  return { ok: true, ...snap, youLead: Number(placed.highId) === Number(bidderId) };
}

export async function retractBid(listingId, bidderId) {
  const { rows } = await query(
    `SELECT * FROM bids WHERE listing_id = $1 AND bidder_id = $2 AND retracted = FALSE ORDER BY created_at DESC LIMIT 1`,
    [listingId, bidderId],
  );
  if (!rows[0]) return { status: 404, body: { error: "No bid to retract" } };
  if (Date.now() - new Date(rows[0].created_at).getTime() > 60 * 60 * 1000) {
    return { status: 400, body: { error: "Bids can only be retracted within one hour" } };
  }
  await query(`UPDATE bids SET retracted = TRUE WHERE id = $1`, [rows[0].id]);
  const listing = (await query(`SELECT * FROM listings WHERE id = $1`, [listingId])).rows[0];
  const remaining = await query(
    `SELECT bidder_id, max_amount, created_at FROM bids WHERE listing_id = $1 AND retracted = FALSE ORDER BY created_at`,
    [listingId],
  );
  let highId = null;
  let highMax = 0;
  let price = Number(listing.auction_start_price || listing.price || 0);
  for (const bid of remaining.rows) {
    const inc = await incrementFor(price);
    const next = applyProxyBid({
      highId,
      highMax,
      price,
      start: listing.auction_start_price || listing.price || 0,
      bidderId: bid.bidder_id,
      maxAmount: Number(bid.max_amount),
      increment: inc,
    });
    highId = next.highId;
    highMax = next.highMax;
    price = next.price;
  }
  const reserve = Number(listing.auction_reserve_price || 0);
  await query(
    `UPDATE listings SET auction_current_price = $2, auction_bid_count = $3 WHERE id = $1`,
    [listingId, price, remaining.rows.length],
  );
  await query(
    `INSERT INTO auction_states (listing_id, high_bidder_id, high_max, current_price, bid_count, reserve_met)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (listing_id) DO UPDATE SET high_bidder_id = $2, high_max = $3, current_price = $4, bid_count = $5, reserve_met = $6, updated_at = NOW()`,
    [listingId, highId, highMax, price, remaining.rows.length, !reserve || price >= reserve],
  );
  const snap = await snapshot(listingId);
  broadcastAuction(listingId, snap);
  return { status: 200, body: { data: { retracted: true }, ...snap } };
}

export async function closeExpiredAuctions() {
  const { rows } = await query(
    `SELECT id FROM listings
     WHERE status = 'active' AND format IN ('auction','both')
       AND auction_ends_at IS NOT NULL AND auction_ends_at <= NOW()`,
  );
  for (const row of rows) {
    try {
      await settleAuction(row.id);
    } catch (err) {
      console.warn("[auctions] settle failed", row.id, err.message);
    }
  }
}

export async function settleAuction(listingId) {
  const listing = (await query(`SELECT * FROM listings WHERE id = $1`, [listingId])).rows[0];
  if (!listing || listing.status !== "active") return;
  const state = (await query(`SELECT * FROM auction_states WHERE listing_id = $1`, [listingId])).rows[0];
  if (!state?.high_bidder_id || !state.reserve_met) {
    await query(`UPDATE listings SET status = 'ended', ended_at = NOW() WHERE id = $1`, [listingId]);
    await notify(listing.seller_id, "auction_ended", "Auction ended", `${listing.title} ended without a winning bid.`, `/listing/${listingId}`);
    return;
  }
  const orderNumber = await nextOrderNumber();
  const amount = Number(state.current_price);
  const order = await query(
    `INSERT INTO orders (order_number, buyer_id, status, subtotal, total_amount, shipping_name)
     VALUES ($1,$2,'pending_payment',$3,$3,$4) RETURNING id`,
    [orderNumber, state.high_bidder_id, amount, "Auction winner"],
  );
  await query(
    `INSERT INTO order_items (order_id, listing_id, seller_id, title, quantity, price, subtotal, total_amount)
     VALUES ($1,$2,$3,$4,1,$5,$5,$5)`,
    [order.rows[0].id, listingId, listing.seller_id, listing.title, amount],
  );
  const deadline = new Date(Date.now() + 48 * 3600 * 1000);
  await query(
    `UPDATE listings SET status = 'sold', auction_winner_id = $2, ended_at = NOW() WHERE id = $1`,
    [listingId, state.high_bidder_id],
  );
  await query(
    `UPDATE auction_states SET payment_deadline = $2, winner_order_id = $3 WHERE listing_id = $1`,
    [listingId, deadline.toISOString(), order.rows[0].id],
  );
  await notify(state.high_bidder_id, "won", "You won the auction", `Pay NPR ${amount} for ${listing.title} within 48 hours.`, "/orders");
  await notify(listing.seller_id, "sold", "Auction sold", `${listing.title} sold for NPR ${amount}.`, "/account?tab=selling");
  const losers = await query(
    `SELECT DISTINCT bidder_id FROM bids WHERE listing_id = $1 AND bidder_id <> $2 AND retracted = FALSE`,
    [listingId, state.high_bidder_id],
  );
  for (const loser of losers.rows) {
    await notify(loser.bidder_id, "lost", "Auction ended", `You did not win ${listing.title}.`, `/listing/${listingId}`);
  }
}

export async function expireUnpaidWinners() {
  const { rows } = await query(
    `SELECT a.listing_id, a.high_bidder_id, a.winner_order_id, l.title, l.seller_id, a.current_price
     FROM auction_states a JOIN listings l ON l.id = a.listing_id
     JOIN orders o ON o.id = a.winner_order_id
     WHERE a.payment_deadline IS NOT NULL AND a.payment_deadline < NOW()
       AND o.status = 'pending_payment' AND a.unpaid_at IS NULL`,
  );
  for (const row of rows) {
    await query(`UPDATE users SET unpaid_strikes = unpaid_strikes + 1 WHERE id = $1`, [row.high_bidder_id]);
    await query(`UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = 'Unpaid auction' WHERE id = $1`, [row.winner_order_id]);
    await query(`UPDATE auction_states SET unpaid_at = NOW() WHERE listing_id = $1`, [row.listing_id]);
    await notify(row.high_bidder_id, "unpaid", "Unpaid strike", "You did not pay in time. A strike was added to your account.", "/orders");
    const next = await query(
      `SELECT bidder_id, MAX(max_amount) AS max FROM bids
       WHERE listing_id = $1 AND bidder_id <> $2 AND retracted = FALSE
       GROUP BY bidder_id ORDER BY max DESC LIMIT 1`,
      [row.listing_id, row.high_bidder_id],
    );
    if (next.rows[0]) {
      await query(
        `INSERT INTO second_chance_offers (listing_id, bidder_id, amount, expires_at)
         VALUES ($1,$2,$3, NOW() + INTERVAL '48 hours')`,
        [row.listing_id, next.rows[0].bidder_id, row.current_price],
      );
      await notify(next.rows[0].bidder_id, "second_chance", "Second-chance offer", `You can buy ${row.title} at NPR ${row.current_price}.`, `/listing/${row.listing_id}`);
    }
  }
}

export async function handleAuctions(method, pathParts, auth, body) {
  if (pathParts[0] === "auctions" && method === "GET" && !pathParts[1]) {
    if (!auth) return { status: 401, body: { error: "Sign in required" } };
    const bids = await query(
      `SELECT b.*, l.title, l.auction_ends_at, l.auction_current_price, l.status AS listing_status
       FROM bids b JOIN listings l ON l.id = b.listing_id
       WHERE b.bidder_id = $1 AND b.retracted = FALSE
       ORDER BY b.created_at DESC LIMIT 40`,
      [auth.user_id],
    );
    const chances = await query(
      `SELECT s.*, l.title FROM second_chance_offers s JOIN listings l ON l.id = s.listing_id
       WHERE s.bidder_id = $1 AND s.status = 'pending' AND s.expires_at > NOW()`,
      [auth.user_id],
    );
    return { status: 200, body: { bids: bids.rows, secondChance: chances.rows } };
  }
  if (pathParts[0] === "auctions" && pathParts[1] === "second-chance" && method === "GET") {
    if (!auth) return { status: 401, body: { error: "Sign in required" } };
    const { rows } = await query(
      `SELECT s.*, l.title FROM second_chance_offers s JOIN listings l ON l.id = s.listing_id
       WHERE s.bidder_id = $1 ORDER BY s.created_at DESC LIMIT 20`,
      [auth.user_id],
    );
    return { status: 200, body: { data: rows } };
  }
  if (pathParts[0] === "auctions" && pathParts[1] && /^\d+$/.test(pathParts[1]) && method === "GET" && pathParts[2] !== "stream") {
    try {
      const snap = await snapshot(pathParts[1]);
      if (!snap.listing) return { status: 404, body: { error: "Auction not found" } };
      return { status: 200, body: snap };
    } catch {
      return { status: 404, body: { error: "Auction not found" } };
    }
  }
  if (pathParts[0] === "auctions" && pathParts[1] && pathParts[2] === "bid" && method === "POST") {
    if (!auth) return { status: 401, body: { error: "Sign in to bid" } };
    if (auth.status !== "active") return { status: 403, body: { error: "This account cannot bid" } };
    const verified = await enforceVerification(auth.user_id);
    if (verified) return verified;
    const risk = await evaluateUser(auth.user_id, { kind: "bid" });
    if (risk.blocked) return { status: 403, body: { error: "Bidding is blocked while this account is under review" } };
    try {
      const result = await placeProxy(pathParts[1], auth.user_id, Number(body.maxAmount || body.amount));
      return { status: 200, body: result };
    } catch (err) {
      return { status: 400, body: { error: err.message } };
    }
  }
  if (pathParts[0] === "auctions" && pathParts[1] && pathParts[2] === "retract" && method === "POST") {
    if (!auth) return { status: 401, body: { error: "Sign in required" } };
    return retractBid(pathParts[1], auth.user_id);
  }
  if (pathParts[0] === "auctions" && pathParts[1] === "blocked" && method === "GET") {
    if (!auth) return { status: 401, body: { error: "Sign in required" } };
    const { rows } = await query(
      `SELECT b.blocked_user_id, b.reason, b.created_at, COALESCE(p.display_name, u.email) AS name
       FROM blocked_bidders b JOIN users u ON u.id = b.blocked_user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE b.seller_id = $1`,
      [auth.user_id],
    );
    return { status: 200, body: { data: rows } };
  }
  if (pathParts[0] === "auctions" && pathParts[1] === "blocked" && method === "POST") {
    if (!auth) return { status: 401, body: { error: "Sign in required" } };
    const blockedId = Number(body.userId);
    if (!blockedId) return { status: 400, body: { error: "userId required" } };
    await query(
      `INSERT INTO blocked_bidders (seller_id, blocked_user_id, reason) VALUES ($1,$2,$3)
       ON CONFLICT (seller_id, blocked_user_id) DO UPDATE SET reason = EXCLUDED.reason`,
      [auth.user_id, blockedId, body.reason || "Blocked by seller"],
    );
    return { status: 200, body: { data: { blocked: blockedId } } };
  }
  if (pathParts[0] === "auctions" && pathParts[1] === "blocked" && pathParts[2] && method === "DELETE") {
    if (!auth) return { status: 401, body: { error: "Sign in required" } };
    await query(`DELETE FROM blocked_bidders WHERE seller_id = $1 AND blocked_user_id = $2`, [auth.user_id, pathParts[2]]);
    return { status: 200, body: { data: { removed: true } } };
  }
  if (pathParts[0] === "auctions" && pathParts[1] === "second-chance" && method === "POST") {
    if (!auth) return { status: 401, body: { error: "Sign in required" } };
    const offer = await query(
      `SELECT * FROM second_chance_offers WHERE id = $1 AND bidder_id = $2 AND status = 'pending' AND expires_at > NOW()`,
      [body.offerId, auth.user_id],
    );
    if (!offer.rows[0]) return { status: 404, body: { error: "Offer not found" } };
    const decision = body.accept ? "accepted" : "declined";
    await query(`UPDATE second_chance_offers SET status = $2 WHERE id = $1`, [body.offerId, decision]);
    if (body.accept) {
      const listing = (await query(`SELECT * FROM listings WHERE id = $1`, [offer.rows[0].listing_id])).rows[0];
      const orderNumber = await nextOrderNumber();
      const amount = Number(offer.rows[0].amount);
      const order = await query(
        `INSERT INTO orders (order_number, buyer_id, status, subtotal, total_amount, shipping_name)
         VALUES ($1,$2,'pending_payment',$3,$3,'Second-chance offer') RETURNING id`,
        [orderNumber, auth.user_id, amount],
      );
      await query(
        `INSERT INTO order_items (order_id, listing_id, seller_id, title, quantity, price, subtotal, total_amount)
         VALUES ($1,$2,$3,$4,1,$5,$5,$5)`,
        [order.rows[0].id, listing.id, listing.seller_id, listing.title, amount],
      );
      const deadline = new Date(Date.now() + 48 * 3600 * 1000);
      await query(
        `UPDATE auction_states SET high_bidder_id = $2, unpaid_at = NULL, payment_deadline = $3, winner_order_id = $4 WHERE listing_id = $1`,
        [listing.id, auth.user_id, deadline.toISOString(), order.rows[0].id],
      );
      await query(`UPDATE listings SET status = 'sold', auction_winner_id = $2 WHERE id = $1`, [listing.id, auth.user_id]);
      await notify(auth.user_id, "won", "Second-chance accepted", `Pay NPR ${amount} within 48 hours.`, "/orders");
      await notify(listing.seller_id, "sold", "Second-chance sold", `${listing.title} sold via second-chance offer.`, "/account?tab=selling");
    }
    return { status: 200, body: { data: { status: decision } } };
  }
  return null;
}

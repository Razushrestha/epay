import { query } from "./db.mjs";
import { nextOrderNumber } from "./commerce-auth.mjs";
import { notify } from "./notify.mjs";

async function listingForOffer(listingId) {
  const { rows } = await query(
    `SELECT id, title, seller_id, price, allow_best_offer, auto_accept_price, auto_decline_price, status, format
     FROM listings WHERE id = $1`,
    [listingId],
  );
  return rows[0];
}

async function acceptOffer(offer, listing) {
  const orderNumber = await nextOrderNumber();
  const amount = Number(offer.amount);
  const order = await query(
    `INSERT INTO orders (order_number, buyer_id, status, subtotal, total_amount, shipping_name)
     VALUES ($1,$2,'pending_payment',$3,$3,$4) RETURNING id`,
    [orderNumber, offer.buyer_id, amount, "Best Offer"],
  );
  await query(
    `INSERT INTO order_items (order_id, listing_id, seller_id, title, quantity, price, subtotal, total_amount)
     VALUES ($1,$2,$3,$4,1,$5,$5,$5)`,
    [order.rows[0].id, listing.id, listing.seller_id, listing.title, amount],
  );
  await query(`UPDATE listings SET status = 'sold', quantity = GREATEST(quantity - 1, 0) WHERE id = $1`, [listing.id]);
  await notify(offer.buyer_id, "offer_accepted", "Offer accepted", `Pay NPR ${amount} for ${listing.title}.`, "/orders");
  await notify(listing.seller_id, "offer_accepted", "You accepted an offer", `${listing.title} sold via Best Offer.`, "/account?tab=selling");
  return order.rows[0];
}

export async function expireOffers() {
  const { rows } = await query(`UPDATE offers SET status = 'expired' WHERE status = 'pending' AND expires_at < NOW() RETURNING id, buyer_id, seller_id`);
  for (const row of rows) {
    await notify(row.buyer_id, "offer_expired", "Offer expired", "Your offer expired before the seller responded.", "/account?tab=activity");
  }
}

export async function handleOffers(method, pathParts, auth, body) {
  if (pathParts[0] !== "offers") return null;
  if (!auth) return { status: 401, body: { error: "Sign in required" } };

  if (method === "GET" && !pathParts[1]) {
    const { rows } = await query(
      `SELECT o.*, l.title FROM offers o JOIN listings l ON l.id = o.listing_id
       WHERE o.buyer_id = $1 OR o.seller_id = $1 ORDER BY o.created_at DESC LIMIT 50`,
      [auth.user_id],
    );
    return { status: 200, body: { data: rows } };
  }

  if (method === "POST" && !pathParts[1]) {
    const listing = await listingForOffer(body.listingId);
    if (!listing || listing.status !== "active") return { status: 400, body: { error: "Listing is not available" } };
    if (!listing.allow_best_offer && listing.format !== "both" && listing.format !== "fixed") {
      return { status: 400, body: { error: "This listing does not accept offers" } };
    }
    if (!listing.allow_best_offer) return { status: 400, body: { error: "This listing does not accept offers" } };
    if (Number(listing.seller_id) === Number(auth.user_id)) return { status: 400, body: { error: "You cannot offer on your own item" } };
    const amount = Number(body.amount);
    if (!(amount > 0)) return { status: 400, body: { error: "Enter a valid amount" } };
    const rounds = await query(
      `SELECT COUNT(*)::int AS c FROM offers WHERE listing_id = $1 AND buyer_id = $2`,
      [listing.id, auth.user_id],
    );
    if (rounds.rows[0].c >= 5) return { status: 400, body: { error: "Offer limit reached for this item" } };

    let status = "pending";
    if (listing.auto_decline_price && amount < Number(listing.auto_decline_price)) status = "auto_declined";
    if (listing.auto_accept_price && amount >= Number(listing.auto_accept_price)) status = "auto_accepted";

    const inserted = await query(
      `INSERT INTO offers (listing_id, buyer_id, seller_id, amount, status, round, message, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, NOW() + INTERVAL '48 hours') RETURNING *`,
      [listing.id, auth.user_id, listing.seller_id, amount, status, rounds.rows[0].c + 1, body.message || null],
    );
    const offer = inserted.rows[0];
    if (status === "auto_accepted") await acceptOffer(offer, listing);
    else if (status === "auto_declined") await notify(auth.user_id, "offer_declined", "Offer declined", "This offer was below the seller's auto-decline amount.", `/listing/${listing.id}`);
    else await notify(listing.seller_id, "offer", "New offer", `NPR ${amount} on ${listing.title}`, "/account?tab=selling");
    return { status: 201, body: { data: offer } };
  }

  if (method === "POST" && pathParts[1] && pathParts[2] === "decide") {
    const { rows } = await query(`SELECT * FROM offers WHERE id = $1`, [pathParts[1]]);
    const offer = rows[0];
    if (!offer || Number(offer.seller_id) !== Number(auth.user_id)) return { status: 404, body: { error: "Offer not found" } };
    if (offer.status !== "pending") return { status: 400, body: { error: "Offer is no longer pending" } };
    const listing = await listingForOffer(offer.listing_id);
    const action = body.action;
    if (action === "accept") {
      await query(`UPDATE offers SET status = 'accepted', decided_at = NOW() WHERE id = $1`, [offer.id]);
      await acceptOffer(offer, listing);
      return { status: 200, body: { data: { status: "accepted" } } };
    }
    if (action === "decline") {
      await query(`UPDATE offers SET status = 'declined', decided_at = NOW() WHERE id = $1`, [offer.id]);
      await notify(offer.buyer_id, "offer_declined", "Offer declined", `The seller declined your offer on ${listing.title}.`, `/listing/${listing.id}`);
      return { status: 200, body: { data: { status: "declined" } } };
    }
    if (action === "counter") {
      const amount = Number(body.amount);
      if (!(amount > 0)) return { status: 400, body: { error: "Enter a counter amount" } };
      if (offer.round >= 6) return { status: 400, body: { error: "No more counters on this thread" } };
      await query(`UPDATE offers SET status = 'countered', decided_at = NOW() WHERE id = $1`, [offer.id]);
      const counter = await query(
        `INSERT INTO offers (listing_id, buyer_id, seller_id, amount, status, round, parent_id, expires_at)
         VALUES ($1,$2,$3,$4,'pending',$5,$6, NOW() + INTERVAL '48 hours') RETURNING *`,
        [offer.listing_id, offer.buyer_id, offer.seller_id, amount, offer.round + 1, offer.id],
      );
      await notify(offer.buyer_id, "offer_counter", "Seller countered", `New price NPR ${amount} on ${listing.title}.`, `/listing/${listing.id}`);
      return { status: 200, body: { data: counter.rows[0] } };
    }
    return { status: 400, body: { error: "Choose accept, decline, or counter" } };
  }

  return { status: 404, body: { error: "Not found" } };
}

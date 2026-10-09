import { closeExpiredAuctions, expireUnpaidWinners } from "./auctions.mjs";
import { expireOffers } from "./offers.mjs";
import { autoCompleteOrders } from "./fulfillment.mjs";
import { escalateSilentCases } from "./returns.mjs";
import { ledgerIntegrity } from "./ledger.mjs";
import { notify } from "./notify.mjs";
import { query } from "./db.mjs";

let timer = null;
let lastLedgerCheck = 0;
let lastMetrics = 0;

async function notifyEndingSoon() {
  const { rows } = await query(
    `SELECT l.id, l.title, l.seller_id, a.high_bidder_id
     FROM listings l
     LEFT JOIN auction_states a ON a.listing_id = l.id
     WHERE l.status = 'active' AND l.format IN ('auction','both')
       AND l.auction_ends_at BETWEEN NOW() AND NOW() + INTERVAL '60 minutes'
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.user_id = COALESCE(a.high_bidder_id, l.seller_id)
           AND n.type = 'ending_soon' AND n.href = '/listing/' || l.id
           AND n.created_at > NOW() - INTERVAL '2 hours'
       )`,
  );
  for (const row of rows) {
    if (row.high_bidder_id) {
      await notify(row.high_bidder_id, "ending_soon", "Auction ending soon", `${row.title} ends within an hour.`, `/listing/${row.id}`);
    }
    await notify(row.seller_id, "ending_soon", "Your auction is ending", `${row.title} ends within an hour.`, `/listing/${row.id}`);
    const watchers = await query(`SELECT user_id FROM watchlist WHERE listing_id = $1`, [row.id]).catch(() => ({ rows: [] }));
    for (const w of watchers.rows) {
      if (Number(w.user_id) !== Number(row.high_bidder_id) && Number(w.user_id) !== Number(row.seller_id)) {
        await notify(w.user_id, "ending_soon", "Watched auction ending", `${row.title} ends soon.`, `/listing/${row.id}`);
      }
    }
  }
}

async function refreshSellerMetrics() {
  const { rows } = await query(`SELECT DISTINCT seller_id FROM order_items`);
  for (const row of rows) {
    const stats = await query(
      `SELECT
         COUNT(*) FILTER (WHERE o.status = 'cancelled')::float / NULLIF(COUNT(*),0) AS cancel_rate,
         COUNT(*) FILTER (WHERE oi.shipped_at IS NOT NULL AND oi.shipped_at > o.paid_at + INTERVAL '3 days')::float
           / NULLIF(COUNT(*) FILTER (WHERE oi.shipped_at IS NOT NULL),0) AS late_rate
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.seller_id = $1 AND o.created_at > NOW() - INTERVAL '90 days'`,
      [row.seller_id],
    );
    const defects = await query(
      `SELECT COUNT(*) FILTER (WHERE rating = 'negative')::float / NULLIF(COUNT(*),0) AS defect
       FROM feedback WHERE seller_id = $1 AND created_at > NOW() - INTERVAL '90 days'`,
      [row.seller_id],
    );
    await query(
      `INSERT INTO seller_metrics (user_id, defect_rate, late_shipment_rate, cancellation_rate, evaluated_at)
       VALUES ($1,$2,$3,$4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         defect_rate = EXCLUDED.defect_rate,
         late_shipment_rate = EXCLUDED.late_shipment_rate,
         cancellation_rate = EXCLUDED.cancellation_rate,
         evaluated_at = NOW()`,
      [
        row.seller_id,
        Number(defects.rows[0]?.defect || 0),
        Number(stats.rows[0]?.late_rate || 0),
        Number(stats.rows[0]?.cancel_rate || 0),
      ],
    );
  }
}

async function tick() {
  try {
    await closeExpiredAuctions();
    await expireUnpaidWinners();
    await expireOffers();
    await autoCompleteOrders();
    await escalateSilentCases();
    await notifyEndingSoon();
    const now = Date.now();
    if (now - lastLedgerCheck > 6 * 3600 * 1000) {
      lastLedgerCheck = now;
      const integrity = await ledgerIntegrity();
      if (!integrity.balanced) console.error("[jobs] ledger imbalance", integrity);
      else console.log("[jobs] ledger ok", integrity);
    }
    if (now - lastMetrics > 12 * 3600 * 1000) {
      lastMetrics = now;
      await refreshSellerMetrics();
    }
  } catch (err) {
    console.error("[jobs]", err.message);
  }
}

export function startJobs() {
  if (timer) return;
  timer = setInterval(tick, 30_000);
  tick().catch(() => {});
  console.log("[jobs] auction/order/offer tick every 30s");
}

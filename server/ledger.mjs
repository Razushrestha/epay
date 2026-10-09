import { query } from "./db.mjs";
import { notify } from "./notify.mjs";

async function accountId(code) {
  const { rows } = await query(`SELECT id FROM ledger_accounts WHERE code = $1`, [code]);
  if (rows[0]) return rows[0].id;
  const inserted = await query(
    `INSERT INTO ledger_accounts (code, name, kind) VALUES ($1, $1, 'liability') RETURNING id`,
    [code],
  );
  return inserted.rows[0].id;
}

export async function postJournal(kind, refType, refId, memo, lines) {
  const debit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const credit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  if (Math.abs(debit - credit) > 0.009) throw new Error("Unbalanced ledger entry");
  const txn = await query(
    `INSERT INTO ledger_transactions (kind, ref_type, ref_id, memo) VALUES ($1, $2, $3, $4) RETURNING id`,
    [kind, refType, String(refId), memo],
  );
  const txnId = txn.rows[0].id;
  for (const line of lines) {
    const acc = await accountId(line.code);
    await query(
      `INSERT INTO ledger_entries (txn_id, account_id, debit, credit) VALUES ($1, $2, $3, $4)`,
      [txnId, acc, Number(line.debit || 0), Number(line.credit || 0)],
    );
  }
  return txnId;
}

export async function feeBreakdown(orderId) {
  const { rows } = await query(
    `SELECT o.total_amount, o.id, oi.seller_id, l.category_id, u.seller_level
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN listings l ON l.id = oi.listing_id
     JOIN users u ON u.id = oi.seller_id
     WHERE o.id = $1 LIMIT 1`,
    [orderId],
  );
  const row = rows[0];
  if (!row) return null;
  const fees = await query(`SELECT * FROM category_fees WHERE category_id = $1`, [row.category_id]);
  const f = fees.rows[0] || { commission_percentage: 10, final_value_fee_percentage: 0, insertion_fee: 0 };
  const amount = Number(row.total_amount);
  let commissionPct = Number(f.commission_percentage || 10);
  if (row.seller_level === "top_rated") commissionPct *= 0.8;
  else if (row.seller_level === "above_standard") commissionPct *= 0.9;
  const commission = +(amount * (commissionPct / 100)).toFixed(2);
  const fvf = +(amount * (Number(f.final_value_fee_percentage || 0) / 100)).toFixed(2);
  const insertion = Number(f.insertion_fee || 0);
  const processing = +(amount * 0.02).toFixed(2);
  const net = +(amount - commission - fvf - insertion - processing).toFixed(2);
  return { sellerId: row.seller_id, amount, commission, fvf, insertion, processing, net };
}

export async function onOrderPaid(orderId) {
  const order = await query(`SELECT id, total_amount, buyer_id, status FROM orders WHERE id = $1`, [orderId]);
  const row = order.rows[0];
  if (!row) return;
  const amount = Number(row.total_amount);
  await postJournal("payment", "order", orderId, "Buyer payment into escrow", [
    { code: "PLATFORM_CASH", debit: amount },
    { code: "PLATFORM_ESCROW", credit: amount },
  ]);
  await query(
    `INSERT INTO escrow_holds (order_id, amount, status) VALUES ($1, $2, 'held')
     ON CONFLICT (order_id) DO UPDATE SET amount = EXCLUDED.amount, status = 'held'`,
    [orderId, amount],
  );
  const fees = await feeBreakdown(orderId);
  if (fees) {
    await query(
      `INSERT INTO seller_wallets (user_id, pending_balance) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET pending_balance = seller_wallets.pending_balance + EXCLUDED.pending_balance, updated_at = NOW()`,
      [fees.sellerId, amount],
    );
    const sellers = await query(`SELECT DISTINCT seller_id FROM order_items WHERE order_id = $1`, [orderId]);
    for (const s of sellers.rows) {
      await notify(s.seller_id, "order_paid", "Payment received", `Order #${orderId} is paid and in escrow.`, "/account?tab=selling");
    }
    await notify(row.buyer_id, "order_paid", "Payment confirmed", "Your payment is held in escrow until delivery.", "/orders");
  }
}

export async function freezeEscrow(orderId) {
  await query(`UPDATE escrow_holds SET status = 'frozen' WHERE order_id = $1 AND status = 'held'`, [orderId]);
}

export async function unfreezeEscrow(orderId) {
  await query(`UPDATE escrow_holds SET status = 'held' WHERE order_id = $1 AND status = 'frozen'`, [orderId]);
}

export async function releaseEscrow(orderId) {
  const hold = await query(`SELECT * FROM escrow_holds WHERE order_id = $1 AND status = 'held'`, [orderId]);
  if (!hold.rows[0]) return { skipped: true };
  const fees = await feeBreakdown(orderId);
  if (!fees) return { skipped: true };
  await postJournal("release", "order", orderId, "Release escrow to seller after fees", [
    { code: "PLATFORM_ESCROW", debit: fees.amount },
    { code: "PLATFORM_REVENUE", credit: +(fees.commission + fees.fvf + fees.insertion + fees.processing).toFixed(2) },
    { code: `SELLER_AVAILABLE_${fees.sellerId}`, credit: fees.net },
  ]);
  await query(`UPDATE escrow_holds SET status = 'released', released_at = NOW() WHERE order_id = $1`, [orderId]);
  await query(
    `INSERT INTO order_fees (order_id, commission, final_value_fee, insertion_fee, processing_fee, net_to_seller)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [orderId, fees.commission, fees.fvf, fees.insertion, fees.processing, fees.net],
  );
  await query(
    `INSERT INTO seller_wallets (user_id, available_balance, pending_balance, lifetime_earnings)
     VALUES ($1, $2, 0, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       available_balance = seller_wallets.available_balance + $2,
       pending_balance = GREATEST(seller_wallets.pending_balance - $3, 0),
       lifetime_earnings = seller_wallets.lifetime_earnings + $2,
       updated_at = NOW()`,
    [fees.sellerId, fees.net, fees.amount],
  );
  await notify(fees.sellerId, "payout_available", "Funds released", `NPR ${fees.net} is now available in your wallet.`, "/account?tab=selling");
  return { released: true, net: fees.net };
}

export async function refundOrder(orderId, amount, reason, actorId) {
  const order = await query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!order.rows[0]) return { status: 404, body: { error: "Order not found" } };
  const total = Number(amount ?? order.rows[0].total_amount);
  await postJournal("refund", "order", orderId, reason || "Refund", [
    { code: "PLATFORM_ESCROW", debit: total },
    { code: "PLATFORM_REFUNDS", credit: total },
  ]);
  await query(`INSERT INTO refunds (order_id, amount, reason, created_by) VALUES ($1,$2,$3,$4)`, [orderId, total, reason, actorId]);
  await query(`UPDATE escrow_holds SET status = 'refunded', released_at = NOW() WHERE order_id = $1`, [orderId]);
  await query(`UPDATE orders SET status = 'refunded' WHERE id = $1`, [orderId]);
  await notify(order.rows[0].buyer_id, "refund", "Refund processed", `NPR ${total} was refunded. ${reason || ""}`, "/orders");
  return { status: 200, body: { data: { refunded: total } } };
}

export async function ledgerIntegrity() {
  const { rows } = await query(`SELECT COALESCE(SUM(debit),0) AS d, COALESCE(SUM(credit),0) AS c FROM ledger_entries`);
  const balanced = Math.abs(Number(rows[0].d) - Number(rows[0].c)) < 0.01;
  return { debit: Number(rows[0].d), credit: Number(rows[0].c), balanced };
}

export async function reconcileGateways() {
  const payments = await query(
    `SELECT gateway, COALESCE(SUM(amount),0) AS total, COUNT(*) FILTER (WHERE status = 'completed')::int AS paid
     FROM payments GROUP BY gateway`,
  );
  const cash = await query(
    `SELECT COALESCE(SUM(le.debit - le.credit),0) AS cash
     FROM ledger_entries le JOIN ledger_accounts a ON a.id = le.account_id
     WHERE a.code = 'PLATFORM_CASH'`,
  );
  const ledgerCash = Number(cash.rows[0]?.cash || 0);
  const paymentTotal = payments.rows.reduce((s, r) => s + Number(r.total || 0), 0);
  const unmatched = await query(
    `SELECT COUNT(*)::int AS c FROM payments p
     WHERE p.status = 'completed'
       AND NOT EXISTS (SELECT 1 FROM ledger_transactions t WHERE t.ref_type = 'order' AND t.ref_id = p.order_id::text AND t.kind = 'payment')`,
  );
  const report = {
    payments: payments.rows,
    paymentTotal,
    ledgerCash,
    unmatched: Number(unmatched.rows[0]?.c || 0),
    balanced: Math.abs(paymentTotal - Math.abs(ledgerCash)) < 1,
  };
  await query(
    `INSERT INTO gateway_reconcile_runs (gateway, payments_total, ledger_cash, unmatched, balanced, details)
     VALUES ('all', $1, $2, $3, $4, $5)`,
    [paymentTotal, ledgerCash, report.unmatched, report.balanced, JSON.stringify(report)],
  ).catch(() => {});
  return report;
}

export async function handleLedger(method, pathParts, auth, body) {
  if (pathParts[0] === "wallet") {
    if (!auth) return { status: 401, body: { error: "Sign in required" } };
    if (method === "GET" && !pathParts[1]) {
      await query(`INSERT INTO seller_wallets (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [auth.user_id]);
      const wallet = await query(`SELECT * FROM seller_wallets WHERE user_id = $1`, [auth.user_id]);
      const accounts = await query(`SELECT id, method, label, details, is_default FROM payout_accounts WHERE user_id = $1`, [auth.user_id]);
      const payouts = await query(`SELECT public_id, amount, method, status, created_at, admin_note FROM payouts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [auth.user_id]);
      const fees = await query(
        `SELECT of.*, o.order_number FROM order_fees of JOIN orders o ON o.id = of.order_id
         JOIN order_items oi ON oi.order_id = o.id WHERE oi.seller_id = $1 ORDER BY of.created_at DESC LIMIT 20`,
        [auth.user_id],
      );
      return { status: 200, body: { wallet: wallet.rows[0], accounts: accounts.rows, payouts: payouts.rows, invoices: fees.rows } };
    }
    if (method === "POST" && pathParts[1] === "accounts") {
      const methodName = ["bank", "esewa", "khalti"].includes(body.method) ? body.method : null;
      if (!methodName) return { status: 400, body: { error: "Choose bank, eSewa, or Khalti" } };
      await query(
        `INSERT INTO payout_accounts (user_id, method, label, details, is_default) VALUES ($1,$2,$3,$4,$5)`,
        [auth.user_id, methodName, body.label || methodName, JSON.stringify(body.details || {}), Boolean(body.isDefault)],
      );
      return { status: 201, body: { data: { saved: true } } };
    }
    if (method === "POST" && pathParts[1] === "payouts") {
      const amount = Number(body.amount);
      if (!(amount >= 1)) return { status: 400, body: { error: "Enter a payout amount of at least NPR 1" } };
      const wallet = await query(`SELECT available_balance FROM seller_wallets WHERE user_id = $1`, [auth.user_id]);
      if (Number(wallet.rows[0]?.available_balance || 0) < amount) return { status: 400, body: { error: "Not enough available balance" } };
      const acc = await query(`SELECT * FROM payout_accounts WHERE user_id = $1 ORDER BY is_default DESC LIMIT 1`, [auth.user_id]);
      if (!acc.rows[0]) return { status: 400, body: { error: "Save a payout account before requesting a payout" } };
      await query(`UPDATE seller_wallets SET available_balance = available_balance - $2, updated_at = NOW() WHERE user_id = $1`, [auth.user_id, amount]);
      const inserted = await query(
        `INSERT INTO payouts (user_id, amount, method, account_snapshot) VALUES ($1,$2,$3,$4) RETURNING public_id`,
        [auth.user_id, amount, acc.rows[0].method, JSON.stringify(acc.rows[0].details || {})],
      );
      await postJournal("payout", "payout", inserted.rows[0].public_id, "Seller payout requested", [
        { code: `SELLER_AVAILABLE_${auth.user_id}`, debit: amount },
        { code: "PLATFORM_CASH", credit: amount },
      ]);
      return { status: 201, body: { data: { requested: amount, public_id: inserted.rows[0].public_id } } };
    }
  }

  if (pathParts[0] === "admin" && pathParts[1] === "payouts") {
    if (!auth?.is_staff) return { status: 403, body: { error: "Staff only" } };
    if (method === "GET") {
      const { rows } = await query(
        `SELECT p.*, u.email, COALESCE(pr.display_name, u.email) AS name
         FROM payouts p JOIN users u ON u.id = p.user_id
         LEFT JOIN user_profiles pr ON pr.user_id = u.id
         ORDER BY p.created_at DESC LIMIT 80`,
      );
      const integrity = await ledgerIntegrity();
      const recon = await reconcileGateways().catch(() => null);
      return { status: 200, body: { data: rows, integrity, recon } };
    }
    if (method === "PATCH" && pathParts[2]) {
      const status = ["approved", "paid", "rejected"].includes(body.status) ? body.status : null;
      if (!status) return { status: 400, body: { error: "Invalid status" } };
      const current = await query(`SELECT * FROM payouts WHERE public_id = $1`, [pathParts[2]]);
      if (!current.rows[0]) return { status: 404, body: { error: "Payout not found" } };
      await query(`UPDATE payouts SET status = $2, admin_note = $3, paid_ref = $4, decided_at = NOW() WHERE public_id = $1`, [
        pathParts[2],
        status,
        body.note || null,
        body.paidRef || null,
      ]);
      if (status === "rejected" && ["pending", "approved"].includes(current.rows[0].status)) {
        const row = current.rows[0];
        await query(`UPDATE seller_wallets SET available_balance = available_balance + $2 WHERE user_id = $1`, [row.user_id, row.amount]);
        await postJournal("payout", "payout", row.public_id, "Seller payout rejected", [
          { code: "PLATFORM_CASH", debit: Number(row.amount) },
          { code: `SELLER_AVAILABLE_${row.user_id}`, credit: Number(row.amount) },
        ]).catch(() => {});
      }
      if (status === "paid") {
        await notify(current.rows[0].user_id, "payout_paid", "Payout sent", `NPR ${current.rows[0].amount} was paid out.`, "/account?tab=selling");
      }
      return { status: 200, body: { data: { status } } };
    }
  }

  if (pathParts[0] === "admin" && pathParts[1] === "refunds" && method === "POST") {
    if (!auth?.is_staff) return { status: 403, body: { error: "Staff only" } };
    return refundOrder(body.orderId, body.amount, body.reason || "Staff refund", auth.user_id);
  }

  if (pathParts[0] === "admin" && pathParts[1] === "ledger" && method === "GET") {
    if (!auth?.is_staff) return { status: 403, body: { error: "Staff only" } };
    return { status: 200, body: { data: await ledgerIntegrity() } };
  }

  return null;
}

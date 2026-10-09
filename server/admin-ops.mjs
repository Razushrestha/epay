import { query } from "./db.mjs";
import { audit, denyUnless } from "./rbac.mjs";

export async function handleAdminOps(method, pathParts, auth, body) {
  if (pathParts[0] === "site" && pathParts[1] === "banners" && method === "GET") {
    const { rows } = await query(
      `SELECT title, image_url, link, position FROM cms_banners
       WHERE active = TRUE AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at >= NOW())
       ORDER BY sort_order, id`,
    );
    return { status: 200, body: { data: rows } };
  }
  if (pathParts[0] === "help" && method === "GET") {
    if (pathParts[1]) {
      const { rows } = await query(`SELECT slug, title, body, updated_at FROM cms_pages WHERE slug = $1 AND status = 'published'`, [pathParts[1]]);
      if (!rows[0]) return { status: 404, body: { error: "Page not found" } };
      return { status: 200, body: { data: rows[0] } };
    }
    const { rows } = await query(`SELECT slug, title FROM cms_pages WHERE status = 'published' ORDER BY title`);
    return { status: 200, body: { data: rows } };
  }

  if (pathParts[0] === "tickets") {
    if (!auth) return { status: 401, body: { error: "Sign in required" } };
    if (method === "GET" && !pathParts[1]) {
      const { rows } = await query(
        `SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 80`,
        [auth.user_id],
      );
      return { status: 200, body: { data: rows } };
    }
    if (method === "POST" && !pathParts[1]) {
      const subject = String(body.subject || "").trim();
      if (!subject) return { status: 400, body: { error: "Subject required" } };
      const inserted = await query(
        `INSERT INTO support_tickets (user_id, subject, category, priority) VALUES ($1,$2,$3,$4) RETURNING *`,
        [auth.user_id, subject.slice(0, 160), body.category || "general", ["low", "normal", "high", "urgent"].includes(body.priority) ? body.priority : "normal"],
      );
      if (body.body) {
        await query(`INSERT INTO support_ticket_messages (ticket_id, sender_id, body) VALUES ($1,$2,$3)`, [
          inserted.rows[0].id,
          auth.user_id,
          String(body.body).slice(0, 4000),
        ]);
      }
      return { status: 201, body: { data: inserted.rows[0] } };
    }
  }

  if (pathParts[0] !== "admin") return null;
  if (!auth?.is_staff) return { status: 403, body: { error: "Staff only" } };

  if (pathParts[1] === "disputes" && method === "GET") {
    const denied = await denyUnless(auth, "disputes", "read");
    if (denied) return denied;
    const { rows } = await query(
      `SELECT c.*, o.order_number, COALESCE(bp.display_name, bu.email) AS buyer, COALESCE(sp.display_name, su.email) AS seller
       FROM cases c
       JOIN orders o ON o.id = c.order_id
       JOIN users bu ON bu.id = c.buyer_id
       JOIN users su ON su.id = c.seller_id
       LEFT JOIN user_profiles bp ON bp.user_id = bu.id
       LEFT JOIN user_profiles sp ON sp.user_id = su.id
       ORDER BY (c.status IN ('escalated','appealed')) DESC, c.opened_at DESC LIMIT 120`,
    );
    return { status: 200, body: { data: rows } };
  }

  if (pathParts[1] === "moderation" && method === "GET") {
    const denied = await denyUnless(auth, "moderation", "read");
    if (denied) return denied;
    const { rows } = await query(
      `SELECT * FROM moderation_queue ORDER BY (decision IS NULL) DESC, created_at DESC LIMIT 120`,
    );
    return { status: 200, body: { data: rows } };
  }

  if (pathParts[1] === "moderation" && pathParts[2] && method === "POST") {
    const denied = await denyUnless(auth, "moderation", "write");
    if (denied) return denied;
    const decision = ["approved", "rejected", "flagged"].includes(body.decision) ? body.decision : null;
    if (!decision) return { status: 400, body: { error: "Choose approved, rejected, or flagged" } };
    const item = await query(`SELECT * FROM moderation_queue WHERE id::text = $1 OR public_id::text = $1`, [pathParts[2]]);
    if (!item.rows[0]) return { status: 404, body: { error: "Queue item not found" } };
    await query(
      `UPDATE moderation_queue SET decision = $2, decided_by = $3, decided_at = NOW() WHERE id = $1`,
      [item.rows[0].id, decision, auth.user_id],
    );
    if (item.rows[0].item_type === "listing") {
      await query(
        `UPDATE listings SET moderation_status = $2, moderated_by = $3, moderated_at = NOW(), moderation_reason = $4 WHERE id::text = $1`,
        [item.rows[0].item_id, decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "flagged", auth.user_id, body.reason || null],
      );
      if (decision === "rejected") {
        await query(`UPDATE listings SET status = 'suspended' WHERE id::text = $1 AND status = 'active'`, [item.rows[0].item_id]);
      }
    }
    await audit(auth, "moderation.decide", item.rows[0].item_type, item.rows[0].item_id, { decision });
    return { status: 200, body: { data: { decision } } };
  }

  if (pathParts[1] === "cms" && method === "GET") {
    const pages = await query(`SELECT * FROM cms_pages ORDER BY slug`);
    const banners = await query(`SELECT * FROM cms_banners ORDER BY sort_order, id`);
    const settings = await query(`SELECT key, value, updated_at FROM site_settings ORDER BY key`);
    return { status: 200, body: { pages: pages.rows, banners: banners.rows, settings: settings.rows } };
  }

  if (pathParts[1] === "cms" && pathParts[2] === "pages" && method === "POST") {
    const slug = String(body.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!slug || !body.title || !body.body) return { status: 400, body: { error: "Slug, title, and body required" } };
    await query(
      `INSERT INTO cms_pages (slug, title, body, status, updated_by) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [slug, body.title, body.body, body.status === "draft" ? "draft" : "published", auth.user_id],
    );
    await audit(auth, "cms.page", "cms_page", slug, body);
    return { status: 200, body: { data: { saved: true, slug } } };
  }

  if (pathParts[1] === "cms" && pathParts[2] === "banners" && method === "POST") {
    await query(
      `INSERT INTO cms_banners (title, image_url, link, position, starts_at, ends_at, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [body.title, body.imageUrl || null, body.link || null, body.position || "home_hero", body.startsAt || null, body.endsAt || null, body.active !== false, Number(body.sortOrder || 0)],
    );
    await audit(auth, "cms.banner", "cms_banner", body.title, body);
    return { status: 201, body: { data: { saved: true } } };
  }

  if (pathParts[1] === "cms" && pathParts[2] === "settings" && method === "PATCH") {
    const key = String(body.key || "").trim();
    if (!key) return { status: 400, body: { error: "Setting key required" } };
    await query(
      `INSERT INTO site_settings (key, value, updated_by) VALUES ($1,$2::jsonb,$3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [key, JSON.stringify(body.value), auth.user_id],
    );
    await audit(auth, "settings.update", "site_settings", key, body.value);
    return { status: 200, body: { data: { saved: true } } };
  }

  if (pathParts[1] === "tickets" && method === "GET") {
    const { rows } = await query(
      `SELECT t.*, u.email, COALESCE(p.display_name, u.email) AS name
       FROM support_tickets t JOIN users u ON u.id = t.user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       ORDER BY (t.status IN ('open','assigned','pending')) DESC, t.created_at DESC LIMIT 120`,
    );
    return { status: 200, body: { data: rows } };
  }

  if (pathParts[1] === "tickets" && method === "POST" && !pathParts[2]) {
    const subject = String(body.subject || "").trim();
    if (!subject) return { status: 400, body: { error: "Subject required" } };
    const inserted = await query(
      `INSERT INTO support_tickets (user_id, subject, category, priority) VALUES ($1,$2,$3,$4) RETURNING *`,
      [auth.user_id, subject.slice(0, 160), body.category || "general", ["low", "normal", "high", "urgent"].includes(body.priority) ? body.priority : "normal"],
    );
    if (body.body) {
      await query(`INSERT INTO support_ticket_messages (ticket_id, sender_id, body) VALUES ($1,$2,$3)`, [
        inserted.rows[0].id,
        auth.user_id,
        String(body.body).slice(0, 4000),
      ]);
    }
    return { status: 201, body: { data: inserted.rows[0] } };
  }

  if (pathParts[1] === "tickets" && pathParts[2] && method === "GET") {
    const ticket = await query(`SELECT * FROM support_tickets WHERE id::text = $1 OR public_id::text = $1`, [pathParts[2]]);
    if (!ticket.rows[0]) return { status: 404, body: { error: "Ticket not found" } };
    const messages = await query(`SELECT * FROM support_ticket_messages WHERE ticket_id = $1 ORDER BY created_at`, [ticket.rows[0].id]);
    return { status: 200, body: { ticket: ticket.rows[0], messages: messages.rows } };
  }

  if (pathParts[1] === "tickets" && pathParts[2] && method === "PATCH") {
    const denied = await denyUnless(auth, "tickets", "write");
    if (denied) return denied;
    const status = ["open", "pending", "assigned", "resolved", "closed"].includes(body.status) ? body.status : null;
    await query(
      `UPDATE support_tickets SET status = COALESCE($2, status), assigned_to = COALESCE($3, assigned_to), updated_at = NOW()
       WHERE id::text = $1 OR public_id::text = $1`,
      [pathParts[2], status, body.assignedTo || auth.user_id],
    );
    if (body.body) {
      const t = await query(`SELECT id FROM support_tickets WHERE id::text = $1 OR public_id::text = $1`, [pathParts[2]]);
      if (t.rows[0]) {
        await query(`INSERT INTO support_ticket_messages (ticket_id, sender_id, body) VALUES ($1,$2,$3)`, [
          t.rows[0].id,
          auth.user_id,
          String(body.body).slice(0, 4000),
        ]);
      }
    }
    await audit(auth, "ticket.update", "ticket", pathParts[2], body);
    return { status: 200, body: { data: { saved: true } } };
  }

  if (pathParts[1] === "audit" && method === "GET") {
    const { rows } = await query(
      `SELECT a.*, u.email FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC LIMIT 150`,
    );
    return { status: 200, body: { data: rows } };
  }

  if (pathParts[1] === "finance" && method === "GET") {
    const denied = await denyUnless(auth, "analytics", "read");
    if (denied) return denied;
    const [gmv, fees, payouts, refunds, ledger] = await Promise.all([
      query(`SELECT COALESCE(SUM(total_amount),0) AS gmv, COUNT(*)::int AS orders FROM orders WHERE status IN ('paid','processing','shipped','delivered','completed')`),
      query(`SELECT COALESCE(SUM(commission+final_value_fee+insertion_fee+processing_fee),0) AS fees FROM order_fees`),
      query(`SELECT status, COALESCE(SUM(amount),0) AS amount, COUNT(*)::int AS c FROM payouts GROUP BY status`),
      query(`SELECT COALESCE(SUM(amount),0) AS refunds FROM refunds`),
      query(`SELECT COALESCE(SUM(debit),0) AS debit, COALESCE(SUM(credit),0) AS credit FROM ledger_entries`),
    ]);
    return {
      status: 200,
      body: {
        gmv: gmv.rows[0],
        fees: fees.rows[0],
        payouts: payouts.rows,
        refunds: refunds.rows[0],
        ledger: ledger.rows[0],
      },
    };
  }

  if (pathParts[1] === "roles" && method === "GET") {
    const roles = await query(`SELECT * FROM staff_roles ORDER BY id`);
    const perms = await query(`SELECT * FROM staff_permissions ORDER BY role_id, module`);
    const staff = await query(
      `SELECT u.public_id, u.email, u.staff_role, COALESCE(p.display_name, u.email) AS name
       FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.is_staff = TRUE AND u.deleted_at IS NULL`,
    );
    return { status: 200, body: { roles: roles.rows, permissions: perms.rows, staff: staff.rows } };
  }

  if (pathParts[1] === "roles" && method === "PATCH") {
    if ((auth.staff_role || "super_admin") !== "super_admin") return { status: 403, body: { error: "Super admin only" } };
    const role = ["super_admin", "moderator", "finance", "support"].includes(body.role) ? body.role : null;
    if (!role || !body.userId) return { status: 400, body: { error: "User and role required" } };
    await query(`UPDATE users SET staff_role = $2, is_staff = TRUE WHERE public_id::text = $1 OR id::text = $1`, [String(body.userId), role]);
    await audit(auth, "role.assign", "user", body.userId, { role });
    return { status: 200, body: { data: { role } } };
  }

  return null;
}

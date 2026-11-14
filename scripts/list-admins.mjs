/** Lists staff accounts (email + role only; passwords are stored hashed and cannot be shown). */
import "dotenv/config";
import { query } from "../server/db.mjs";

const { rows } = await query(
  `SELECT id, email, staff_role, created_at FROM users WHERE is_staff = TRUE ORDER BY id`,
);
if (!rows.length) console.log("No staff accounts exist yet.");
for (const row of rows) console.log(`${row.id}\t${row.email}\t${row.staff_role}\t${row.created_at?.toISOString?.() ?? row.created_at}`);
process.exit(0);

import { query } from "./db.mjs";

export async function commerceBlock(userId) {
  if (!userId) return null;
  const { rows } = await query(`SELECT status FROM users WHERE id = $1`, [userId]);
  const status = rows[0]?.status;
  if (status === "restricted" || status === "suspended") {
    return {
      status: 403,
      body: { error: "Your account is restricted. Open Account standing to appeal." },
    };
  }
  return null;
}

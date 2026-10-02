export async function writeAudit(db, entry) {
  const {
    actorId = null,
    actorType = "user",
    action,
    entityType = null,
    entityId = null,
    oldValue = null,
    newValue = null,
    ip = null,
    userAgent = null,
  } = entry;
  await db.query(
    `INSERT INTO audit_logs
      (actor_id, actor_type, action, entity_type, entity_id, old_value, new_value, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
    [
      actorId,
      actorType,
      action,
      entityType,
      entityId,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      ip,
      userAgent,
    ],
  );
}
